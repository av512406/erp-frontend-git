import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { comparePassword } from '../lib/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required.");
}
const JWT_SECRET = process.env.SESSION_SECRET;

router.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = result.rows[0];

        // Check password (supports both hashed and legacy plain text)
        let isValid = false;

        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isValid = await comparePassword(password, user.password);
        } else {
            // Legacy plain text check
            isValid = user.password === password;
        }

        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if school is active (for non-superadmin)
        if (user.role !== 'superadmin' && user.school_id) {
            const schoolRes = await pool.query('SELECT is_active FROM schools WHERE id = $1', [user.school_id]);
            if (schoolRes.rows.length > 0 && !schoolRes.rows[0].is_active) {
                return res.status(403).json({ message: 'Your school account has been deactivated. Please contact support.' });
            }
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                schoolId: user.school_id
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                schoolId: user.school_id
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Login failed' });
    }
});

router.post('/api/logout', (req, res) => {
    // Client-side logout (clear token)
    res.json({ message: 'Logged out' });
});

router.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: (req as any).user });
});

export const authRouter = router;
