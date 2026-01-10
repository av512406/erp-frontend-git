import { Router, Request, Response } from "express";
import { db } from "./db";
import {
    schools, academicSessions, subjects, teachers, students,
    studentSessions, classSubjects, feeTransactions, grades
} from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Helper to ensure authenticated user has schoolId
const requireSchoolAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user || !req.user.schoolId) {
        return res.status(401).json({ message: "Not authenticated or no school associated" });
    }
    next();
};

router.get("/export", requireSchoolAdmin, async (req: Request, res: Response) => {
    try {
        const schoolId = req.user!.schoolId!;

        // Fetch data concurrently
        const [
            fetchedSchools,
            fetchedSessions,
            fetchedSubjects,
            fetchedTeachers,
            fetchedStudents,
            fetchedStudentSessions,
            fetchedClassSubjects,
            fetchedFees,
            fetchedGrades
        ] = await Promise.all([
            db.select().from(schools).where(eq(schools.id, schoolId)),
            db.select().from(academicSessions).where(eq(academicSessions.schoolId, schoolId)),
            db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
            db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
            db.select().from(students).where(eq(students.schoolId, schoolId)),
            db.select().from(studentSessions).where(eq(studentSessions.schoolId, schoolId)),
            db.select().from(classSubjects).where(eq(classSubjects.schoolId, schoolId)),
            db.select().from(feeTransactions).where(eq(feeTransactions.schoolId, schoolId)),
            db.select().from(grades).where(eq(grades.schoolId, schoolId)),
        ]);

        const backupData = {
            meta: {
                timestamp: new Date().toISOString(),
                schoolId: schoolId,
                version: "1.0",
                recordCounts: {
                    schools: fetchedSchools.length,
                    academicSessions: fetchedSessions.length,
                    subjects: fetchedSubjects.length,
                    teachers: fetchedTeachers.length,
                    students: fetchedStudents.length,
                    studentSessions: fetchedStudentSessions.length,
                    classSubjects: fetchedClassSubjects.length,
                    feeTransactions: fetchedFees.length,
                    grades: fetchedGrades.length
                }
            },
            data: {
                schools: fetchedSchools,
                academicSessions: fetchedSessions,
                subjects: fetchedSubjects,
                teachers: fetchedTeachers,
                students: fetchedStudents,
                studentSessions: fetchedStudentSessions,
                classSubjects: fetchedClassSubjects,
                feeTransactions: fetchedFees,
                grades: fetchedGrades
            }
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=school_backup_${schoolId}_${new Date().toISOString().split('T')[0]}.json`);
        res.json(backupData);

    } catch (error) {
        console.error("Backup export error:", error);
        res.status(500).json({ message: "Failed to create backup" });
    }
});

router.post("/restore", requireSchoolAdmin, async (req: Request, res: Response) => {
    try {
        const schoolId = req.user!.schoolId!;
        const backup = req.body;

        if (!backup || !backup.meta || !backup.data) {
            return res.status(400).json({ message: "Invalid backup file format" });
        }

        if (backup.meta.schoolId !== schoolId) {
            return res.status(403).json({ message: "Backup file does not belong to this school" });
        }

        // Transactional Restore
        await db.transaction(async (tx) => {
            // 1. Delete existing data in reverse order of dependencies
            await tx.delete(grades).where(eq(grades.schoolId, schoolId));
            await tx.delete(feeTransactions).where(eq(feeTransactions.schoolId, schoolId));
            await tx.delete(studentSessions).where(eq(studentSessions.schoolId, schoolId));
            await tx.delete(classSubjects).where(eq(classSubjects.schoolId, schoolId));
            // Teachers and Students might have circular dependcies or other links? 
            // Usually students depend on schools.
            await tx.delete(students).where(eq(students.schoolId, schoolId));
            await tx.delete(teachers).where(eq(teachers.schoolId, schoolId));
            await tx.delete(subjects).where(eq(subjects.schoolId, schoolId));
            await tx.delete(academicSessions).where(eq(academicSessions.schoolId, schoolId));

            // Note: We do NOT delete the 'schools' record itself, just the data within it.

            // 2. Insert new data in order of dependencies
            // We assume the backup data has valid IDs and references.
            const d = backup.data;

            if (d.academicSessions?.length) await tx.insert(academicSessions).values(d.academicSessions);
            if (d.subjects?.length) await tx.insert(subjects).values(d.subjects);
            if (d.teachers?.length) await tx.insert(teachers).values(d.teachers);
            if (d.students?.length) await tx.insert(students).values(d.students);
            if (d.classSubjects?.length) await tx.insert(classSubjects).values(d.classSubjects);
            if (d.studentSessions?.length) await tx.insert(studentSessions).values(d.studentSessions);
            if (d.feeTransactions?.length) await tx.insert(feeTransactions).values(d.feeTransactions);
            if (d.grades?.length) await tx.insert(grades).values(d.grades);

            // Verify school record integrity if needed (e.g. if specific fields need update)
        });

        res.json({ message: "Restore successful", recordCounts: backup.meta.recordCounts });

    } catch (error) {
        console.error("Restore error:", error);
        res.status(500).json({ message: "Restore failed: " + (error as Error).message });
    }
});

export default router;
