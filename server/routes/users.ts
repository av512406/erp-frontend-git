import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertUserSchema } from '@shared/schema';
import { hashPassword } from '../lib/auth';
import { ZodError } from 'zod';

const router = Router();

router.get('/api/users', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const result = await pool.query('SELECT id, username, role, name, created_at FROM users WHERE school_id = $1 ORDER BY name', [user.schoolId]);
        res.json(result.rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.post('/api/users', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
        const data = insertUserSchema.parse(req.body);
        const role = data.role || 'teacher';
        const name = data.name || 'User';

        // 1. Enforce Limits per school
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND school_id = $2', [role, currentUser.schoolId]);
        const count = parseInt(countRes.rows[0].count);

        if (role === 'teacher' && count >= 50) return res.status(400).json({ message: 'Maximum limit of teachers reached.' });
        if (role === 'admin' && count >= 5) return res.status(400).json({ message: 'Maximum limit of admins reached.' });
        if (role === 'accountant' && count >= 5) return res.status(400).json({ message: 'Maximum limit of accountants reached.' });

        // 2. Format Username (username@schoolname.com)
        const schoolRes = await pool.query('SELECT slug FROM schools WHERE id = $1', [currentUser.schoolId]);
        const schoolSlug = schoolRes.rows[0]?.slug || 'school';
        const domain = schoolSlug + '.com';

        let finalUsername = data.username;
        if (!finalUsername.includes('@')) {
            finalUsername = `${finalUsername}@${domain}`;
        }

        const id = genId();
        const hashedPassword = await hashPassword(data.password);

        const q = await pool.query(
            'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role, name',
            [id, finalUsername, hashedPassword, role, name, currentUser.schoolId]
        );
        res.status(201).json(q.rows[0]);
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
        if ((e as any)?.code === '23505') return res.status(409).json({ message: 'Username already exists' });
        console.error(e);
        res.status(500).json({ message: 'Failed to create user' });
    }
});

router.put('/api/users/:id', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
        const id = req.params.id;
        const { password, role, name } = req.body;

        const check = await pool.query('SELECT id FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (password) { updates.push(`password = $${idx++}`); values.push(password); }
        if (role) { updates.push(`role = $${idx++}`); values.push(role); }
        if (name) { updates.push(`name = $${idx++}`); values.push(name); }

        if (updates.length === 0) return res.json({ message: 'No changes' });

        values.push(id);
        values.push(currentUser.schoolId);

        const q = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} AND school_id = $${idx + 1} RETURNING id, username, role, name`,
            values
        );

        if (q.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        res.json(q.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to update user' });
    }
});

router.delete('/api/users/:id', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
        const id = req.params.id;

        const userRes = await pool.query('SELECT role FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const role = userRes.rows[0].role;
        if (role === 'admin') {
            const countRes = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND school_id = $2', ['admin', currentUser.schoolId]);
            const count = parseInt(countRes.rows[0].count);
            if (count <= 1) {
                return res.status(403).json({ message: 'Cannot delete the only administrator. Create another admin first.' });
            }
        }

        await pool.query('DELETE FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
        res.json({ deleted: id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

export const userRouter = router;
