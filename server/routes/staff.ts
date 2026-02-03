import { Router } from 'express';
import { db, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { staff, staffPayments } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { insertStaffSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all staff for a school (optional session filter)
router.get('/api/staff', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { sessionId } = req.query;

    try {
        const conditions = [eq(staff.schoolId, user.schoolId)];
        if (sessionId) {
            conditions.push(eq(staff.sessionId, sessionId as string));
        }

        const rows = await db.select()
            .from(staff)
            .where(and(...conditions))
            .orderBy(asc(staff.name));

        res.json(rows.map(r => ({
            ...r,
            monthlySalary: parseFloat(r.monthlySalary),
            joiningDate: r.joiningDate ? new Date(r.joiningDate).toISOString().split('T')[0] : null,
        })));
    } catch (e) {
        console.error('Error fetching staff:', e);
        res.status(500).json({ message: 'Failed to fetch staff' });
    }
});

// Add new staff
router.post('/api/staff', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        // Enforce sessionId if req.body has it, otherwise Zod might allow optional if schema is nullable
        const data = insertStaffSchema.parse(req.body);

        // User requirement: "All have session_id constraint"
        // If not in body, check if passed or strictly required?
        // Frontend sends it now. Let's strictly require it in logic if schema allows null.
        const sessionId = (req.body as any).sessionId;

        if (!sessionId) {
            // For legacy compatibility, maybe allow? 
            // But request asked for "CONSTRAINT".
            // Let's warn or error? 
            // "Make sure staff ... all have session_id constraint"
            return res.status(400).json({ message: 'Session ID is required for staff creation' });
        }

        const [newStaff] = await db.insert(staff).values({
            ...data,
            schoolId: user.schoolId,
            sessionId: sessionId,
            status: data.status || 'active'
        } as any).returning();

        res.status(201).json({
            ...newStaff,
            monthlySalary: parseFloat(newStaff.monthlySalary),
            joiningDate: newStaff.joiningDate ? new Date(newStaff.joiningDate).toISOString().split('T')[0] : null
        });
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', issues: e.format() });
        }
        console.error('Error adding staff:', e);
        res.status(500).json({ message: 'Failed to add staff' });
    }
});

// Update staff
router.put('/api/staff/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        const data = insertStaffSchema.parse(req.body);

        // Note: we generally don't change sessionId on simple edit unless specified.

        const [updated] = await db.update(staff)
            .set({
                ...data,
                updatedAt: new Date(),
                // preserve sessionId unless we specifically want to move them?
                // The body might contain sessionId from frontend form.
                // If so, update it.
                // But schema parse includes/excludes it?
                // insertStaffSchema is based on schema. sessionId is in schema.
                // So data might include it if frontend sends it.
            } as any)
            .where(and(eq(staff.id, id), eq(staff.schoolId, user.schoolId)))
            .returning();

        if (!updated) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        res.json({
            ...updated,
            monthlySalary: parseFloat(updated.monthlySalary),
            joiningDate: updated.joiningDate ? new Date(updated.joiningDate).toISOString().split('T')[0] : null
        });
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', issues: e.format() });
        }
        console.error('Error updating staff:', e);
        res.status(500).json({ message: 'Failed to update staff' });
    }
});

// Delete staff (Hard Delete with Transaction)
router.delete('/api/staff/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        await db.transaction(async (tx) => {
            // 1. Delete all payments related to this staff member
            // Check ownership via schoolId
            await tx.delete(staffPayments)
                .where(and(
                    eq(staffPayments.staffId, id),
                    eq(staffPayments.schoolId, user.schoolId)
                ));

            // 2. Delete the staff member
            const deleted = await tx.delete(staff)
                .where(and(
                    eq(staff.id, id),
                    eq(staff.schoolId, user.schoolId)
                ))
                .returning({ id: staff.id });

            if (deleted.length === 0) {
                // If staff checking returned length 0, it means either not found or not in school
                // We should rollback by throwing error
                throw new Error('STAFF_NOT_FOUND');
            }
        });

        res.json({ message: 'Staff and related transactions deleted successfully' });
    } catch (e: any) {
        if (e.message === 'STAFF_NOT_FOUND') {
            return res.status(404).json({ message: 'Staff not found' });
        }
        console.error('Error deleting staff:', e);
        res.status(500).json({ message: 'Failed to delete staff' });
    }
});

export const staffRouter = router;
