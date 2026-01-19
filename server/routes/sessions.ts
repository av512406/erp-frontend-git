import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { ZodError, z } from 'zod';

const router = Router();

router.post('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Only School Admin can manage sessions' });

    const schema = z.object({
        name: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2025-26)"),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        isActive: z.boolean().optional()
    });

    const client = await pool.connect();
    try {
        const data = schema.parse(req.body);

        const exists = await client.query(
            'SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2',
            [data.name, user.schoolId]
        );

        if (exists.rowCount && exists.rowCount > 0) {
            return res.status(409).json({ message: 'Session with this name already exists' });
        }

        const id = genId();
        await client.query('BEGIN');
        try {
            const insertRes = await client.query(
                `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [id, data.name, data.startDate, data.endDate, data.isActive ?? false, user.schoolId]
            );

            if (data.isActive) {
                await client.query('UPDATE academic_sessions SET is_active = false WHERE school_id = $1 AND id != $2', [user.schoolId, id]);
                await client.query('UPDATE schools SET current_session_id = $1 WHERE id = $2', [id, user.schoolId]);
            }

            await client.query('COMMIT');
            res.status(201).json({ ...data, id, schoolId: user.schoolId });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        if ((e as any)?.code === '23505') return res.status(409).json({ message: 'Session already exists' });
        console.error(e);
        res.status(500).json({ message: 'failed to create session' });
    } finally {
        client.release();
    }
});

router.put('/api/sessions/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Only School Admin can manage sessions' });

    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const schema = z.object({
        name: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2025-26)").optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        isActive: z.boolean().optional()
    });

    const client = await pool.connect();
    try {
        const data = schema.parse({ name, startDate, endDate, isActive });
        await client.query('BEGIN');

        const check = await client.query('SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
        if (check.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Session not found' });
        }

        if (data.name) {
            const dup = await client.query('SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2 AND id <> $3', [data.name, user.schoolId, id]);
            if (dup.rowCount! > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'Session name already exists' });
            }
        }

        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (data.name) { updates.push(`name = $${idx++}`); values.push(data.name); }
        if (data.startDate) { updates.push(`start_date = $${idx++}`); values.push(data.startDate); }
        if (data.endDate) { updates.push(`end_date = $${idx++}`); values.push(data.endDate); }
        if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.isActive); }

        if (updates.length > 0) {
            updates.push(`updated_at = now()`);
            values.push(id);
            await client.query(
                `UPDATE academic_sessions SET ${updates.filter(u => !u.includes('updated_at')).join(', ')} WHERE id = $${idx}`,
                values
            );
        }

        const finalRow = await client.query('SELECT * FROM academic_sessions WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.json(finalRow.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to update session' });
    } finally {
        client.release();
    }
});

router.delete('/api/sessions/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { id } = req.params;
    try {
        const q = await pool.query('DELETE FROM academic_sessions WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
        if (q.rowCount === 0) return res.status(404).json({ message: 'Session not found' });
        res.json({ message: 'Session deleted' });
    } catch (e: any) {
        if (e.code === '23503') return res.status(400).json({ message: 'Cannot delete session with linked data' });
        console.error(e);
        res.status(500).json({ message: 'Failed to delete session' });
    }
});

router.get('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        if (!user.schoolId) return res.json([]);
        const query = 'SELECT * FROM academic_sessions WHERE school_id = $1 ORDER BY start_date DESC';
        const { rows } = await pool.query(query, [user.schoolId]);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to list sessions' });
    }
});

router.post('/api/schools/session', requireAuth, async (req, res) => {
    res.json({ message: 'Session switch handled via settings', promotedStudents: 0 });
});

export const sessionRouter = router;
