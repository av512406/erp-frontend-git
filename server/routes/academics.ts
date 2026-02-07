import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertTeacherSchema, insertSubjectSchema, insertClassSchema } from '@shared/schema';
import { mapSubject } from '../lib/mappers';
import { ZodError } from 'zod';

const router = Router();

// Teachers
router.get('/api/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query('SELECT * FROM teachers WHERE school_id = $1 ORDER BY name', [user.schoolId]);
    res.json(rows);
});

router.post('/api/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertTeacherSchema.parse(req.body);
        const id = genId();
        const q = await pool.query(
            'INSERT INTO teachers (id, name, date_of_joining, salary, address, mobile_number, qualification, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [id, data.name, data.dateOfJoining, data.salary, data.address, data.mobileNumber, data.qualification, user.schoolId]
        );
        res.status(201).json(q.rows[0]);
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to create teacher' });
    }
});

router.put('/api/teachers/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
        const data = insertTeacherSchema.partial().parse(req.body);
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (data.name) { fields.push(`name=$${idx++}`); values.push(data.name); }
        if (data.dateOfJoining) { fields.push(`date_of_joining=$${idx++}`); values.push(data.dateOfJoining); }
        if (data.salary) { fields.push(`salary=$${idx++}`); values.push(data.salary); }
        if (data.address) { fields.push(`address=$${idx++}`); values.push(data.address); }
        if (data.mobileNumber) { fields.push(`mobile_number=$${idx++}`); values.push(data.mobileNumber); }
        if (data.qualification) { fields.push(`qualification=$${idx++}`); values.push(data.qualification); }

        if (fields.length === 0) return res.json({ message: 'No changes' });

        values.push(id);
        values.push(user.schoolId);
        const q = await pool.query(
            `UPDATE teachers SET ${fields.join(', ')} WHERE id=$${idx++} AND school_id=$${idx++} RETURNING *`,
            values
        );
        if (q.rowCount === 0) return res.status(404).json({ message: 'Teacher not found' });
        res.json(q.rows[0]);
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to update teacher' });
    }
});

router.delete('/api/teachers/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    const q = await pool.query('DELETE FROM teachers WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
    if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Teacher not found' });
    res.json({ deleted: id });
});

// Subjects
router.get('/api/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query('SELECT * FROM subjects WHERE school_id = $1 ORDER BY name', [user.schoolId]);
    res.json(rows.map(mapSubject));
});

router.post('/api/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertSubjectSchema.parse(req.body);
        const exists = await pool.query('SELECT id FROM subjects WHERE name = $1 AND school_id = $2', [data.name, user.schoolId]);
        if ((exists.rowCount ?? 0) > 0) return res.status(409).json({ message: 'Subject already exists' });
        const id = genId();
        const q = await pool.query('INSERT INTO subjects (id, code, name, school_id) VALUES ($1, $2, $3, $4) RETURNING *', [id, data.code, data.name, user.schoolId]);
        res.status(201).json(mapSubject(q.rows[0]));
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to create subject' });
    }
});

router.delete('/api/subjects/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    await pool.query('DELETE FROM subjects WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
    res.json({ deleted: id });
});

// Class Management
router.get('/api/classes', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const query = `
        SELECT c.*, u.name as teacher_name 
        FROM classes c
        LEFT JOIN users u ON c.class_teacher_id = u.id
        WHERE c.school_id = $1
        ORDER BY c.grade, c.section
      `;
        const { rows } = await pool.query(query, [user.schoolId]);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch classes' });
    }
});

router.post('/api/classes', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertClassSchema.parse(req.body);

        const grade = data.grade.trim();
        const section = data.section.trim();

        const exists = await pool.query(
            'SELECT 1 FROM classes WHERE grade = $1 AND section = $2 AND school_id = $3',
            [grade, section, user.schoolId]
        );
        if (exists.rowCount && exists.rowCount > 0) {
            return res.status(409).json({ message: 'Class already exists' });
        }

        const id = genId();
        await pool.query(
            'INSERT INTO classes (id, grade, section, class_teacher_id, school_id) VALUES ($1, $2, $3, $4, $5)',
            [id, grade, section, data.classTeacherId || null, user.schoolId]
        );

        res.status(201).json({ message: 'Class created' });
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to create class' });
    }
});

router.delete('/api/classes/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        await pool.query('DELETE FROM classes WHERE id = $1 AND school_id = $2', [req.params.id, user.schoolId]);
        res.json({ message: 'Class deleted' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to delete class' });
    }
});

router.put('/api/classes/:id/assign-teacher', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { teacherId } = req.body;
    try {
        await pool.query(
            'UPDATE classes SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3',
            [teacherId, req.params.id, user.schoolId]
        );
        res.json({ message: 'Teacher assigned' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to assign teacher' });
    }
});

router.post('/api/classes/assign-roll-numbers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
        const { classId } = req.body;
        const clsRes = await client.query('SELECT grade, section FROM classes WHERE id = $1', [classId]);
        if (clsRes.rows.length === 0) return res.status(404).json({ message: 'Class not found' });
        const { grade, section } = clsRes.rows[0];

        const sessionRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        const sessionId = sessionRes.rows[0].current_session_id;

        await client.query('BEGIN');

        const studentsRes = await client.query(`
              SELECT s.id, ss.id as session_record_id
              FROM students s
              JOIN student_sessions ss ON s.id = ss.student_id
              WHERE ss.grade = $1 AND ss.section = $2 AND ss.session_id = $3 AND ss.school_id = $4
              ORDER BY s.name ASC
          `, [grade, section, sessionId, user.schoolId]);

        let roll = 1;
        for (const row of studentsRes.rows) {
            await client.query('UPDATE student_sessions SET roll_number = $1 WHERE id = $2', [String(roll++), row.session_record_id]);
        }

        await client.query('COMMIT');
        res.json({ message: `Assigned roll numbers to ${studentsRes.rows.length} students` });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Failed to assign roll numbers' });
    } finally {
        client.release();
    }
});

router.get('/api/users/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query(
            "SELECT id, name, role FROM users WHERE school_id = $1 AND role IN ('teacher', 'admin', 'superadmin') ORDER BY name",
            [user.schoolId]
        );
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch teachers' });
    }
});

// Subject Assignments
router.get('/api/classes/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // Use classes table as the source of truth for defined grades
    const classRes = await pool.query(
        `SELECT DISTINCT grade FROM classes WHERE school_id = $1 ORDER BY grade`,
        [user.schoolId]
    );

    res.json(classRes.rows.map(r => r.grade));
});

router.get('/api/classes/:grade/sections', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;

    // Use classes table as source of truth
    const classRes = await pool.query(
        `SELECT DISTINCT section FROM classes WHERE school_id = $1 AND TRIM(grade) = TRIM($2) ORDER BY section`,
        [user.schoolId, grade]
    );
    res.json(classRes.rows.map(r => r.section));
});

router.get('/api/classes/:grade/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const { rows } = await pool.query(
        `SELECT s.*, cs.max_marks FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.grade=$1 AND cs.school_id=$2 ORDER BY s.name`,
        [grade, user.schoolId]
    );
    res.json(rows.map(mapSubject));
});

router.post('/api/classes/:grade/sync-all', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const sourceGrade = req.params.grade.trim();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const src = await client.query(`SELECT subject_id FROM class_subjects WHERE TRIM(grade)=TRIM($1) AND school_id=$2`, [sourceGrade, user.schoolId]);
        const subjectIds: string[] = src.rows.map((r: any) => r.subject_id);
        if (subjectIds.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No subjects assigned to source class (checked with TRIM)' });
        }
        const gradesRes = await client.query(`
            SELECT DISTINCT grade FROM classes WHERE school_id=$1
        `, [user.schoolId]);
        const allGrades: string[] = gradesRes.rows.map((r: any) => r.grade);

        let inserted = 0;
        let skipped = 0;

        for (const g of allGrades) {
            // Skip if it's the source class itself
            if (g.trim() === sourceGrade) continue;

            for (const sid of subjectIds) {
                const id = genId();
                try {
                    const insertRes = await client.query(
                        `INSERT INTO class_subjects (id, grade, subject_id, school_id) VALUES ($1,$2,$3,$4)
               ON CONFLICT (grade, subject_id) DO NOTHING`,
                        [id, g, sid, user.schoolId]
                    );
                    if (insertRes.rowCount && insertRes.rowCount > 0) {
                        inserted++;
                    } else {
                        skipped++;
                    }
                } catch { }
            }
        }
        await client.query('COMMIT');
        res.json({ syncedFrom: sourceGrade, targetClasses: allGrades.length, subjectsCount: subjectIds.length, inserted, skipped });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'sync failed' });
    } finally {
        client.release();
    }
});

router.post('/api/classes/:grade/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const { subjectId, maxMarks } = req.body as { subjectId: string; maxMarks?: number };
    if (!subjectId) return res.status(400).json({ message: 'subjectId required' });
    const id = genId();
    try {
        const subCheck = await pool.query('SELECT id FROM subjects WHERE id = $1 AND school_id = $2', [subjectId, user.schoolId]);
        if ((subCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Subject not found' });

        await pool.query('INSERT INTO class_subjects (id, grade, subject_id, max_marks, school_id) VALUES ($1,$2,$3,$4,$5)', [id, grade, subjectId, maxMarks ?? null, user.schoolId]);
        res.status(201).json({ id, grade, subjectId, maxMarks: maxMarks ?? null });
    } catch (e) {
        if ((e as any)?.code === '23505') return res.status(409).json({ message: 'already assigned' });
        res.status(500).json({ message: 'failed to assign' });
    }
});

router.put('/api/classes/:grade/subjects/:subjectId', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    const { maxMarks } = req.body as { maxMarks?: number };
    try {
        const q = await pool.query('UPDATE class_subjects SET max_marks=$1 WHERE grade=$2 AND subject_id=$3 AND school_id=$4 RETURNING *', [maxMarks ?? null, grade, subjectId, user.schoolId]);
        if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'assignment not found' });
        res.json({ grade, subjectId, maxMarks: q.rows[0].max_marks });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to update' });
    }
});

router.delete('/api/classes/:grade/subjects/:subjectId', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    await pool.query('DELETE FROM class_subjects WHERE grade=$1 AND subject_id=$2 AND school_id=$3', [grade, subjectId, user.schoolId]);
    res.json({ grade, subjectId, unassigned: true });
});

export const academicRouter = router;
