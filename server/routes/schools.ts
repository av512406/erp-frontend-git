import { Router } from 'express';
import { pool, db, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { hashPassword } from '../lib/auth';
import { documentTemplates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.get('/api/school-config', requireAuth, async (req, res) => {
    const user = (req as any).user;

    // Super Admin Fallback
    if (user.role === 'superadmin' && !user.schoolId) {
        return res.json({
            id: 'system',
            name: 'System Admin',
            slug: 'system',
            features: { attendance: true, sms: true, finance: true }, // Enable all by default for superadmin context
            logoUrl: '',
            examPattern: ["Term 1", "Term 2"],
            session: '2025-26'
        });
    }

    try {
        const { rows } = await pool.query(`
        SELECT s.id, s.name, s.slug, s.address, s.phone, s.logo_url as "logoUrl", s.exam_pattern as "examPattern", s.features, ac.name as "session"
        FROM schools s
        LEFT JOIN academic_sessions ac ON s.current_session_id = ac.id
        WHERE s.id = $1
      `, [user.schoolId]);

        if (rows.length === 0) {
            // If user has schoolId but school not found (deleted?), or role is admin but no school?
            return res.status(404).json({ message: 'School not found' });
        }

        const school = rows[0];
        // Parse JSON fields
        try {
            if (typeof school.examPattern === 'string') school.examPattern = JSON.parse(school.examPattern);
        } catch { school.examPattern = ["Term 1", "Term 2", "Final"]; }

        try {
            if (typeof school.features === 'string') school.features = JSON.parse(school.features);
        } catch { school.features = { attendance: false }; }

        // Default if null
        if (!school.features) school.features = { attendance: false };

        res.json(school);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch config' });
    }
});

// Super Admin: School Management
router.get('/api/schools', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { rows } = await pool.query('SELECT * FROM schools ORDER BY created_at DESC');
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch schools' });
    }
});

router.post('/api/schools', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
        const { name, slug, address, phone, logoUrl, examPattern } = req.body;
        // Basic validation
        if (!name || !slug) return res.status(400).json({ message: 'Name and Slug are required' });

        await client.query('BEGIN');

        const id = genId();
        const patternStr = examPattern ? JSON.stringify(examPattern) : '["Term 1", "Term 2", "Final"]';

        const featuresStr = req.body.features ? JSON.stringify(req.body.features) : '{"attendance": false}';

        const q = await client.query(
            'INSERT INTO schools (id, name, slug, address, phone, logo_url, exam_pattern, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [id, name, slug, address, phone, logoUrl, patternStr, featuresStr]
        );

        // Create a default admin for this school
        const adminId = genId();
        const adminUsername = `admin@${slug}.com`;
        const adminPassword = `${slug}123`; // Default password
        const hashedAdminPassword = await hashPassword(adminPassword);

        await client.query(
            'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [adminId, adminUsername, hashedAdminPassword, 'admin', 'School Admin', id]
        );

        // 3. Seed Academic Sessions (Fix for Consistency)
        const existingSessions = await client.query('SELECT DISTINCT ON (name) name, start_date, end_date, is_active FROM academic_sessions');

        let sessionTemplates = existingSessions.rows;
        if (sessionTemplates.length === 0) {
            // Default sessions if none exist (First school)
            sessionTemplates = [
                { name: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_active: true }
            ];
        }

        for (const s of sessionTemplates) {
            await client.query(
                `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, $3, $4, $5, $6)`,
                [genId(), s.name, s.start_date, s.end_date, s.is_active, id]
            );
        }

        // 4. Set current_session_id to the active one (Self-Healing)
        const activeSessionRes = await client.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true LIMIT 1', [id]);
        if (activeSessionRes.rows.length > 0) {
            await client.query('UPDATE schools SET current_session_id = $1 WHERE id = $2', [activeSessionRes.rows[0].id, id]);
        }

        await client.query('COMMIT');

        res.status(201).json({ school: q.rows[0], admin: { username: adminUsername, password: adminPassword } });
    } catch (e: any) {
        await client.query('ROLLBACK');
        if (e.code === '23505') return res.status(409).json({ message: 'School slug already exists' });
        console.error(e);
        res.status(500).json({ message: 'Failed to create school' });
    } finally {
        client.release();
    }
});

router.patch('/api/schools/:id/toggle-status', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { id } = req.params;
        const { isActive } = req.body;
        await pool.query('UPDATE schools SET is_active = $1 WHERE id = $2', [isActive, id]);
        res.json({ message: 'Status updated' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to update status' });
    }
});

router.post('/api/schools/:id/admin', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { id } = req.params;
        const { username, password } = req.body;

        if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

        const hashedPassword = await hashPassword(password);

        // Check if username exists (globally unique)
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            const existingUser = await pool.query('SELECT school_id FROM users WHERE username = $1', [username]);
            if (existingUser.rows[0].school_id !== id) {
                return res.status(409).json({ message: 'Username already taken by another user' });
            }
            await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, username]);
        } else {
            const adminId = genId();
            await pool.query(
                'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [adminId, username, hashedPassword, 'admin', 'School Admin', id]
            );
        }

        res.json({ message: 'Admin credentials updated' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to update admin' });
    }
});

router.put('/api/schools/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const isSuperAdmin = user.role === 'superadmin';
    const isSchoolAdmin = user.role === 'admin' && user.schoolId === req.params.id;

    if (!isSuperAdmin && !isSchoolAdmin) return res.status(403).json({ message: 'Forbidden' });

    try {
        const { id } = req.params;
        const { name, slug, address, phone, logoUrl, examPattern, session } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Logic for session update
            let newSessionId = undefined;
            if (session) {
                const sessRes = await client.query('SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2', [session, id]);
                if (sessRes.rows.length > 0) {
                    newSessionId = sessRes.rows[0].id;
                } else {
                    const insRes = await client.query(
                        "INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, '2025-04-01', '2026-03-31', true, $3) RETURNING id",
                        [genId(), session, id]
                    );
                    newSessionId = insRes.rows[0].id;
                }
            }

            if (examPattern && Array.isArray(examPattern)) {
                const currentRes = await client.query('SELECT exam_pattern FROM schools WHERE id = $1', [id]);
                if (currentRes.rows.length > 0) {
                    let currentPattern = currentRes.rows[0].exam_pattern;
                    if (typeof currentPattern === 'string') {
                        try { currentPattern = JSON.parse(currentPattern); } catch (e) { currentPattern = []; }
                    }
                    if (Array.isArray(currentPattern)) {
                        for (let i = 0; i < Math.min(currentPattern.length, examPattern.length); i++) {
                            const oldTerm = currentPattern[i];
                            const newTerm = examPattern[i];
                            if (oldTerm !== newTerm) {
                                await client.query(
                                    'UPDATE grades SET term = $1 WHERE school_id = $2 AND term = $3',
                                    [newTerm, id, oldTerm]
                                );
                            }
                        }
                    }
                }
            }

            const updates: string[] = [];
            const values: any[] = [];
            let idx = 1;

            if (name) { updates.push(`name = $${idx++}`); values.push(name); }
            if (slug) { updates.push(`slug = $${idx++}`); values.push(slug); }
            if (address) { updates.push(`address = $${idx++}`); values.push(address); }
            if (phone) { updates.push(`phone = $${idx++}`); values.push(phone); }
            if (logoUrl !== undefined) { updates.push(`logo_url = $${idx++}`); values.push(logoUrl); }
            if (examPattern) { updates.push(`exam_pattern = $${idx++}`); values.push(JSON.stringify(examPattern)); }
            if (newSessionId) { updates.push(`current_session_id = $${idx++}`); values.push(newSessionId); }
            if (isSuperAdmin && req.body.features) { updates.push(`features = $${idx++}`); values.push(JSON.stringify(req.body.features)); }

            updates.push(`updated_at = now()`);
            values.push(id);

            await client.query(
                `UPDATE schools SET ${updates.join(', ')} WHERE id = $${idx}`,
                values
            );

            await client.query('COMMIT');
            res.json({ message: 'School updated' });
        } catch (e: any) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e: any) {
        if (e.code === '23505') return res.status(409).json({ message: 'Slug already exists' });
        console.error(e);
        res.status(500).json({ message: 'Failed to update school' });
    }
});

router.delete('/api/schools/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        await client.query('DELETE FROM grades WHERE school_id = $1', [id]);
        await client.query('DELETE FROM fee_transactions WHERE school_id = $1', [id]);
        await client.query('DELETE FROM class_subjects WHERE school_id = $1', [id]);
        await client.query('DELETE FROM subjects WHERE school_id = $1', [id]);
        await client.query('DELETE FROM students WHERE school_id = $1', [id]);
        await client.query('DELETE FROM teachers WHERE school_id = $1', [id]);
        await client.query('DELETE FROM users WHERE school_id = $1', [id]);
        await client.query('DELETE FROM schools WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.json({ message: 'School deleted' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Failed to delete school' });
    } finally {
        client.release();
    }
});

// Document Templates
router.get("/api/templates/:type", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const schoolId = (req as any).user.schoolId;
        if (!schoolId) return res.status(400).json({ message: "No school associated with user" });

        const { type } = req.params;
        const [template] = await db
            .select()
            .from(documentTemplates)
            .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
            .limit(1);

        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch template" });
    }
});

router.get("/api/schools/:schoolId/templates/:type", async (req, res) => {
    try {
        const { schoolId, type } = req.params;
        const [template] = await db
            .select()
            .from(documentTemplates)
            .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
            .limit(1);

        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch template" });
    }
});

router.post("/api/schools/:schoolId/templates", async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { type, content, config } = req.body;

        const [existing] = await db
            .select()
            .from(documentTemplates)
            .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
            .limit(1);

        if (existing) {
            const [updated] = await db
                .update(documentTemplates)
                .set({ content, config, updatedAt: new Date().toISOString() })
                .where(eq(documentTemplates.id, existing.id))
                .returning();
            res.json(updated);
        } else {
            const [created] = await db
                .insert(documentTemplates)
                .values({
                    schoolId,
                    type,
                    content,
                    config,
                    // createdAt removed: not in schema
                    updatedAt: new Date().toISOString()
                })
                .returning();
            res.json(created);
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to save template" });
    }
});

export const schoolRouter = router;
