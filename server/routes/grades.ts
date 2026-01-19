import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertGradeSchema } from '@shared/schema';
import { mapGrade } from '../lib/mappers';

const router = Router();

router.get('/api/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;

    let sessionId = req.query.sessionId as string;
    if (!sessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        sessionId = schoolRes.rows[0]?.current_session_id;
    }
    if (!sessionId) {
        const sessionRes = await pool.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
        if (sessionRes.rows.length > 0) sessionId = sessionRes.rows[0].id;
    }

    if (user.role === 'teacher') {
        const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
        if (classRes.rows.length === 0) return res.json([]);

        const { grade, section } = classRes.rows[0];

        const query = `
        SELECT g.* 
        FROM grades g
        JOIN students s ON g.student_id = s.id
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE g.school_id = $1
          AND ss.grade = $2 
          AND ss.section = $3
          AND ss.status IN ('active', 'promoted')
      `;

        const { rows } = await pool.query(query, [user.schoolId, grade, section]);
        return res.json(rows.map(mapGrade));
    }

    const { rows } = await pool.query('SELECT * FROM grades WHERE school_id = $1 AND (session_id = $2 OR session_id IS NULL)', [user.schoolId, sessionId]);
    res.json(rows.map(mapGrade));
});

router.post('/api/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const incoming = req.body as any[];
    if (!Array.isArray(incoming)) return res.status(400).json({ message: 'grades array required' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const keys: { studentId: string; subject: string; term: string }[] = [];
        for (const g of incoming) {
            try {
                const data = insertGradeSchema.parse(g);
                const studentCheck = await client.query('SELECT id FROM students WHERE id=$1 AND school_id=$2', [data.studentId, user.schoolId]);
                if ((studentCheck.rowCount ?? 0) === 0) continue;

                if (user.role === 'teacher') {
                    const allowed = await client.query(`
              SELECT 1 
              FROM classes c
              JOIN student_sessions ss ON c.grade = ss.grade AND c.section = ss.section
              WHERE c.class_teacher_id = $1 
                AND ss.student_id = $2
                AND ss.status = 'active'
            `, [user.id, data.studentId]);

                    if ((allowed.rowCount ?? 0) === 0) {
                        console.warn(`Teacher ${user.username} attempted to grade student ${data.studentId} not in their class.`);
                        continue;
                    }
                }

                const exists = await client.query('SELECT id FROM grades WHERE student_id=$1 AND subject=$2 AND term=$3 AND school_id=$4', [data.studentId, data.subject, data.term, user.schoolId]);
                const sessionRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
                let sessionId = sessionRes.rows[0]?.current_session_id;
                if (!sessionId) {
                    const activeRes = await client.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
                    sessionId = activeRes.rows[0]?.id;
                }

                if ((exists.rowCount ?? 0) > 0) {
                    await client.query('UPDATE grades SET marks=$1 WHERE id=$2', [data.marks, exists.rows[0].id]);
                } else {
                    const id = genId();
                    await client.query('INSERT INTO grades (id, student_id, subject, marks, term, school_id, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, data.studentId, data.subject, data.marks, data.term, user.schoolId, sessionId]);
                }
                keys.push({ studentId: data.studentId, subject: data.subject, term: data.term });
            } catch (e) {
            }
        }
        await client.query('COMMIT');
        if (keys.length === 0) return res.json({ updated: 0, grades: [] });
        const conditions = keys.map((k, i) => `(student_id=$${i * 3 + 1} AND subject=$${i * 3 + 2} AND term=$${i * 3 + 3})`).join(' OR ');
        const params: any[] = [];
        keys.forEach(k => { params.push(k.studentId, k.subject, k.term); });
        const refreshed = await pool.query(`SELECT * FROM grades WHERE (${conditions}) AND school_id = $${params.length + 1}`, [...params, user.schoolId]);
        res.json({ updated: keys.length, grades: refreshed.rows.map(mapGrade) });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'failed' });
    } finally {
        client.release();
    }
});

export const gradeRouter = router;
