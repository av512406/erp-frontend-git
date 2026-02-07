import { Router, Request, Response } from "express";
import { db } from "./db";
import { schools } from "@shared/schema";
import { orderedBackupTables } from "@shared/backup_config";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Helper to ensure authenticated user has schoolId
const requireSchoolAdmin = (req: Request, res: Response, next: Function) => {
    // @ts-ignore
    if (!req.user || !req.user.schoolId) {
        return res.status(401).json({ message: "Not authenticated or no school associated" });
    }
    next();
};

router.get("/export", requireSchoolAdmin, async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).user!.schoolId!;

        // 1. Generic Fetch
        // Iterate over registry to fetch data for each table
        const combinedData: Record<string, any[]> = {};
        const recordCounts: Record<string, number> = {};

        for (const config of orderedBackupTables) {
            // Special handling for 'schools' or tables that might need specific filters?
            // The schema tables usually have 'schoolId'.
            // centralized logic: db.select().from(table).where(eq(table.schoolId, schoolId))
            // We need to access the 'schoolId' column safely.
            // In Drizzle, config.table.schoolId works if it exists.

            // Checking if table has schoolId column:
            if ('schoolId' in config.table) {
                const rows = await db.select().from(config.table).where(eq(config.table.schoolId, schoolId));
                combinedData[config.name] = rows;
                recordCounts[config.name] = rows.length;
            } else if (config.name === 'schools') {
                // Schools table check by ID
                const rows = await db.select().from(config.table).where(eq(config.table.id, schoolId));
                combinedData[config.name] = rows;
                recordCounts[config.name] = rows.length;
            } else {
                // Fallback or skip if no schoolId (should not happen based on our schema, except maybe global enums?)
                // For now, empty or log warning.
                combinedData[config.name] = [];
                recordCounts[config.name] = 0;
            }
        }

        const backupData = {
            meta: {
                timestamp: new Date().toISOString(),
                schoolId: schoolId,
                version: "2.0", // Bump version for new format logic
                recordCounts: recordCounts
            },
            data: combinedData
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=school_backup_${schoolId}_${new Date().toISOString().split('T')[0]}.json`);
        res.json(backupData);

    } catch (error) {
        console.error("Backup export error:", error);
        res.status(500).json({ message: "Failed to create backup" });
    }
});

// Helper to fix date strings for Drizzle timestamp columns
const fixDates = (row: any) => {
    const newRow: any = { ...row };
    for (const key in newRow) {
        const val = newRow[key];
        if (typeof val === 'string') {
            // Check for ISO timestamp format (simple check: YYYY-MM-DDTHH:mm:ss...)
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                newRow[key] = new Date(val);
            }
        }
    }
    return newRow;
};

router.post("/restore", requireSchoolAdmin, async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).user!.schoolId!;
        const backup = req.body;

        if (!backup || !backup.meta || !backup.data) {
            return res.status(400).json({ message: "Invalid backup file format" });
        }

        if (backup.meta.schoolId !== schoolId) {
            return res.status(403).json({ message: "Backup file does not belong to this school" });
        }

        // Transactional Restore
        await db.transaction(async (tx: any) => {
            // 0. Break circular dependency: Set current_session_id to NULL in schools table
            await tx.update(schools).set({ currentSessionId: null }).where(eq(schools.id, schoolId));

            // 1. Delete existing data in REVERSE dependency order
            // clone array and reverse
            const deletionOrder = [...orderedBackupTables].reverse();

            for (const config of deletionOrder) {
                if (config.name === 'schools') continue; // Do not delete the school itself!

                // Skip users delete to prevent lockout, as per audit decision
                if (config.name === 'users') continue;

                if ('schoolId' in config.table) {
                    await tx.delete(config.table).where(eq(config.table.schoolId, schoolId));
                }
            }

            // 2. Insert new data in dependency order
            const d = backup.data;
            for (const config of orderedBackupTables) {
                const rawRows = d[config.name];
                if (rawRows && rawRows.length > 0) {
                    // Special handling for 'schools' - we update, not insert
                    if (config.name === 'schools') {
                        continue;
                    }

                    // Special handling for users
                    if (config.name === 'users') continue;

                    // Fix Dates for Timestamp columns
                    const rows = rawRows.map(fixDates);

                    try {
                        console.log(`Restoring table: ${config.name} with ${rows.length} rows`);
                        await tx.insert(config.table).values(rows);
                    } catch (insertError) {
                        console.error(`FAILED to restore table ${config.name}`);
                        if (rows.length > 0) {
                            console.error('First row sample:', JSON.stringify(rows[0]));
                        }
                        throw insertError;
                    }
                }
            }

            // 3. Restore current_session_id
            if (d.schools && d.schools.length > 0) {
                const restoredSchool = d.schools.find((s: any) => s.id === schoolId);
                if (restoredSchool && restoredSchool.currentSessionId) {
                    await tx.update(schools)
                        .set({ currentSessionId: restoredSchool.currentSessionId })
                        .where(eq(schools.id, schoolId));
                }
            }
        });

        res.json({ message: "Restore successful", recordCounts: backup.meta.recordCounts });

    } catch (error) {
        console.error("Restore error trace:", error);
        res.status(500).json({ message: "Restore failed: " + (error as Error).message });
    }
});

export default router;
