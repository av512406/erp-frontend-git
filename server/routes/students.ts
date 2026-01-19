import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertStudentSchema } from '@shared/schema';
import { mapStudent } from '../lib/mappers';
import { ZodError } from 'zod';

const router = Router();

router.get('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { sessionId } = req.query;

    try {
        // Resolve Session ID
        let targetSessionId = sessionId as string;
        if (!targetSessionId) {
            const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
            targetSessionId = schoolRes.rows[0]?.current_session_id;

            if (!targetSessionId) {
                const sessionRes = await pool.query(
                    'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
                    [user.schoolId]
                );
                if (sessionRes.rows.length > 0) {
                    targetSessionId = sessionRes.rows[0].id;
                }
            }
        }

        if (!targetSessionId) {
            return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } });
        }

        const page = req.query.page ? parseInt(req.query.page as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const grade = req.query.grade as string;
        const section = req.query.section as string;
        const searchTerm = req.query.q as string;

        const params: any[] = [targetSessionId, user.schoolId];
        const conditions: string[] = [
            "ss.session_id = $1",
            "ss.school_id = $2",
            "(ss.status = 'active' OR ss.status = 'promoted')"
        ];

        if (grade && grade !== 'all') {
            conditions.push(`ss.grade = $${params.length + 1}`);
            params.push(grade);
        }

        if (section && section !== 'all') {
            conditions.push(`ss.section = $${params.length + 1}`);
            params.push(section);
        }

        if (user.role === 'teacher') {
            const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
            if (classRes.rows.length === 0) {
                return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } });
            }
            const assigned = classRes.rows[0];
            conditions.push(`ss.grade = $${params.length + 1}`);
            params.push(assigned.grade);
            conditions.push(`ss.section = $${params.length + 1}`);
            params.push(assigned.section);
        }

        if (searchTerm) {
            const q = `%${searchTerm}%`;
            conditions.push(`(s.name ILIKE $${params.length + 1} OR s.admission_number ILIKE $${params.length + 1})`);
            params.push(q);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        if (page && limit) {
            const offset = (page - 1) * limit;

            const countQuery = `
          SELECT COUNT(*) as total
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
        `;
            const countRes = await pool.query(countQuery, params);
            const total = parseInt(countRes.rows[0].total);

            const dataQuery = `
          SELECT 
            s.*,
            ss.grade as session_grade,
            ss.section as session_section,
            ss.status as session_status,
            ss.roll_number
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
          ORDER BY ss.grade, ss.section, s.name
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
            const queryParams = [...params, limit, offset];
            const { rows } = await pool.query(dataQuery, queryParams);

            const mapped = rows.map(row => ({
                ...mapStudent(row),
                grade: row.session_grade || row.grade,
                section: row.session_section || row.section,
                status: row.session_status || row.status,
                rollNumber: row.roll_number
            }));

            return res.json({
                data: mapped,
                meta: { total, page, limit }
            });
        } else {
            const query = `
          SELECT 
            s.*,
            ss.grade as session_grade,
            ss.section as session_section,
            ss.status as session_status,
            ss.roll_number
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
          ORDER BY ss.grade, ss.section, s.name
        `;
            const { rows } = await pool.query(query, params);
            const mapped = rows.map(row => ({
                ...mapStudent(row),
                grade: row.session_grade || row.grade,
                section: row.session_section || row.section,
                status: row.session_status || row.status,
                rollNumber: row.roll_number
            }));
            res.json(mapped);
        }
    } catch (e) {
        console.error('Error fetching students:', e);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
});

router.get('/api/sessions/:id/candidates', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const targetSessionId = req.params.id;
    const { sourceSessionId } = req.query;

    if (!sourceSessionId) return res.status(400).json({ message: 'sourceSessionId required' });

    try {
        const query = `
        SELECT s.*, ss.grade as current_grade, ss.section as current_section 
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE ss.session_id = $1 
          AND ss.school_id = $2
          AND ss.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM student_sessions target 
            WHERE target.student_id = s.id AND target.session_id = $3
          )
        ORDER BY ss.grade, ss.section, s.name
      `;

        const { rows } = await pool.query(query, [sourceSessionId, user.schoolId, targetSessionId]);
        res.json(rows.map(r => ({
            ...mapStudent(r),
            grade: r.current_grade,
            section: r.current_section
        })));
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch candidates' });
    }
});

router.post('/api/students/promote', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { targetSessionId, students } = req.body;

    if (!targetSessionId || !Array.isArray(students)) {
        return res.status(400).json({ message: 'Invalid payload' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const inserted = [];
        for (const s of students) {
            const id = genId();
            await client.query(
                `INSERT INTO student_sessions (id, student_id, session_id, school_id, grade, section, roll_number, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            ON CONFLICT (student_id, session_id) DO UPDATE SET
              grade = EXCLUDED.grade,
              section = EXCLUDED.section,
              status = 'active'
           `,
                [id, s.studentId, targetSessionId, user.schoolId, s.grade, s.section, s.rollNumber || null]
            );
            inserted.push(s.studentId);
        }

        await client.query('COMMIT');
        res.json({ message: `Promoted/Imported ${inserted.length} students` });
    } catch (e) {
        res.status(500).json({ message: 'Failed to fetch absentee list' });
    }
});

router.post('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const client = await pool.connect();
    try {
        const data = insertStudentSchema.parse(req.body);

        const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        const sessionId = schoolRes.rows[0]?.current_session_id;

        if (!sessionId) {
            return res.status(400).json({ message: 'Active academic session not set for school' });
        }

        await client.query('BEGIN');

        const exists = await client.query('SELECT 1 FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);
        if ((exists.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'admissionNumber exists' });
        }

        const id = genId();
        const q = await client.query(
            `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, school_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16) RETURNING *`,
            [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber, data.penNumber, data.aaparId, data.mobileNumber, data.address, data.grade, data.section, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount || 0, user.schoolId]
        );

        await client.query(
            `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [genId(), id, sessionId, data.grade, data.section, 'active', user.schoolId]
        );

        await client.query('COMMIT');
        res.status(201).json(mapStudent(q.rows[0]));
    } catch (e) {
        await client.query('ROLLBACK');
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'internal error' });
    } finally {
        client.release();
    }
});

router.put('/api/students/:admissionNumber', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const admissionNumber = req.params.admissionNumber;
        const data = insertStudentSchema.partial().parse(req.body);
        const existing = await pool.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });

        const keys = Object.keys(data);
        const values: any[] = [];
        const sets: string[] = [];
        keys.forEach((k, i) => {
            const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^admission_number$/, 'admission_number');
            sets.push(`${col} = $${i + 1}`);
            values.push((data as any)[k]);
        });
        if (sets.length === 0) return res.json(mapStudent(existing.rows[0]));

        values.push(admissionNumber);
        values.push(user.schoolId);

        const q = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE admission_number = $${sets.length + 1} AND school_id = $${sets.length + 2} RETURNING *`, values);
        res.json(mapStudent(q.rows[0]));
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'internal error' });
    }
});

router.delete('/api/students/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
        await pool.query('DELETE FROM students WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
        res.json({ deleted: id });
    } catch (e: any) {
        if (e.code === '23503') {
            const table = e.table || 'related records';
            return res.status(409).json({ message: `Cannot delete student because they have existing references in ${table}. Please withdraw the student instead or delete related data first.` });
        }
        console.error('Delete student error:', e);
        res.status(500).json({ message: 'Failed to delete student' });
    }
});

router.post('/api/students/import', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { students: imported, strategy, targetSessionId } = req.body as { students: any[]; strategy?: string; targetSessionId?: string };
    if (!Array.isArray(imported)) return res.status(400).json({ message: 'students array required' });
    const client = await pool.connect();
    try {
        const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        const currentActiveSessionId = schoolRes.rows[0]?.current_session_id;

        const allSessionsRes = await client.query('SELECT id, name FROM academic_sessions');
        const sessionMap = new Map<string, string>();
        allSessionsRes.rows.forEach(row => {
            sessionMap.set(row.name.trim().toLowerCase(), row.id);
        });

        const fallbackSessionId = targetSessionId || currentActiveSessionId;

        await client.query('BEGIN');
        const added: any[] = [];
        const skipped: string[] = [];
        let updated = 0;
        const existingClasses = new Set<string>();

        for (const row of imported) {
            try {
                await client.query('SAVEPOINT row_sp');
                const data = insertStudentSchema.parse(row);

                if (data.grade && data.section) {
                    const classKey = `${data.grade}-${data.section}`;
                    if (!existingClasses.has(classKey)) {
                        await client.query(
                            `INSERT INTO classes (id, grade, section, school_id) 
                   VALUES ($1, $2, $3, $4) 
                   ON CONFLICT (school_id, grade, section) DO NOTHING`,
                            [genId(), data.grade, data.section, user.schoolId]
                        );
                        existingClasses.add(classKey);
                    }
                }

                const rowSessionName = (row.session || row['Session'] || row['Session Name'] || row.sessionName || '').toString().trim();
                let effectiveSessionId = fallbackSessionId;

                if (rowSessionName) {
                    const fromMap = sessionMap.get(rowSessionName.toLowerCase());
                    if (fromMap) {
                        effectiveSessionId = fromMap;
                    } else {
                        console.warn(`Import: Session '${rowSessionName}' not found. Using fallback.`);
                    }
                }

                let studentId = null;

                const exists = await client.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);

                if ((exists.rowCount ?? 0) > 0) {
                    studentId = exists.rows[0].id;
                    if (strategy === 'upsert') {
                        await client.query(
                            `UPDATE students SET name=$1, date_of_birth=$2, admission_date=$3, aadhar_number=$4, pen_number=$5, aapar_id=$6, mobile_number=$7, address=$8, grade=$9, section=$10, father_name=$11, mother_name=$12, yearly_fee_amount=$13, category=$14, gender=$15, previous_year_due=$16 WHERE admission_number=$17 AND school_id=$18`,
                            [data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', data.admissionNumber, user.schoolId]
                        );
                        updated++;
                    } else {
                        skipped.push(data.admissionNumber);
                    }
                } else {
                    studentId = genId();
                    await client.query(
                        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, category, gender, previous_year_due, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16, $17, $18, $19)`,
                        [studentId, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', user.schoolId]
                    );
                    added.push(data.admissionNumber);
                }

                if (studentId && effectiveSessionId) {
                    const sessCheck = await client.query('SELECT 1 FROM student_sessions WHERE student_id = $1 AND session_id = $2', [studentId, effectiveSessionId]);
                    if ((sessCheck.rowCount ?? 0) === 0) {
                        await client.query(
                            `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [genId(), studentId, effectiveSessionId, data.grade, data.section, 'active', user.schoolId]
                        );
                    } else if (strategy === 'upsert') {
                        await client.query(
                            `UPDATE student_sessions SET grade=$1, section=$2 WHERE student_id=$3 AND session_id=$4`,
                            [data.grade, data.section, studentId, effectiveSessionId]
                        );
                    }
                }

                await client.query('RELEASE SAVEPOINT row_sp');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT row_sp');
                console.error('Import validation error:', e);
            }
        }
        await client.query('COMMIT');
        res.json({ added: added.length, skipped: skipped.length, skippedAdmissionNumbers: skipped, updated });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'import failed' });
    } finally {
        client.release();
    }
});

router.get('/api/students/withdrawn', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
});

router.put('/api/students/:admissionNumber/withdraw', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const admissionNumber = req.params.admissionNumber;
        const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
        const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
        const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
        const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 AND school_id=$5 RETURNING *', ['left', dateToSet, reason || null, admissionNumber, user.schoolId]);
        res.json(mapStudent(q.rows[0]));
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to mark withdrawn' });
    }
});

router.put('/api/students/:admissionNumber/restore', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const admissionNumber = req.params.admissionNumber;
        const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });
        const current = existing.rows[0];
        if (current.status !== 'left') {
            return res.json(mapStudent(current));
        }
        const q = await pool.query('UPDATE students SET status=$1, left_date=NULL, leaving_reason=NULL WHERE admission_number=$2 AND school_id=$3 RETURNING *', ['active', admissionNumber, user.schoolId]);
        res.json(mapStudent(q.rows[0]));
    } catch (e: any) {
        console.error('restore error', e);
        res.status(500).json({ message: e?.message || 'failed to restore' });
    }
});

/**
 * Legacy aliases for backwards compatibility if frontend still uses them
 */
router.get('/api/students/left', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
});

router.put('/api/students/:admissionNumber/leave', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const admissionNumber = req.params.admissionNumber;
        const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
        const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
        const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
        const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 AND school_id=$5 RETURNING *', ['left', dateToSet, reason || null, admissionNumber, user.schoolId]);
        res.json(mapStudent(q.rows[0]));
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to mark left' });
    }
});

export const studentRouter = router;
