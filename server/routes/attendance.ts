import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth, requireFeature } from '../middleware/auth';

const router = Router();

router.get('/api/teacher/my-class', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        const classRes = await pool.query('SELECT * FROM classes WHERE class_teacher_id = $1', [user.id]);
        const teacherInfo = { id: user.id, name: user.name };

        if (classRes.rows.length === 0) return res.json({ teacher: teacherInfo, class: null });

        res.json({ teacher: teacherInfo, class: classRes.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error fetching teacher class' });
    }
});

router.get('/api/teacher/my-class/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'teacher' && user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    try {
        const classRes = await pool.query('SELECT * FROM classes WHERE class_teacher_id = $1', [user.id]);
        if (classRes.rows.length === 0) return res.status(404).json({ message: 'No class assigned' });
        const cls = classRes.rows[0];

        const { sessionId } = req.query;
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const query = `
        SELECT 
          s.id, s.name, s.admission_number, ss.roll_number, s.mobile_number
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE ss.grade = $1 AND ss.section = $2 
          AND ss.session_id = $3 AND ss.school_id = $4
          AND ss.status = 'active'
        ORDER BY s.name
      `;

        const { rows } = await pool.query(query, [cls.grade, cls.section, sessionId, user.schoolId]);

        const mapped = rows.map(r => ({
            id: r.id,
            name: r.name,
            admissionNumber: r.admission_number,
            rollNumber: r.roll_number,
            mobileNumber: r.mobile_number,
            yearlyFee: 0,
            totalPaid: 0,
            balance: 0
        }));

        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch class students' });
    }
});

router.get('/api/teacher/my-class/attendance-summary', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'teacher' && user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    try {
        const { startDate, endDate } = req.query;

        const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
        if (classRes.rows.length === 0) return res.status(404).json({ message: 'No class assigned' });
        const { grade, section } = classRes.rows[0];

        const targetSessionId = req.query.sessionId as string;
        if (!targetSessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const sessionId = targetSessionId;

        let dateFilter = "";
        const queryParams: any[] = [sessionId, user.schoolId, grade, section];

        if (startDate && endDate) {
            dateFilter = ` AND date >= $${queryParams.length + 1} AND date <= $${queryParams.length + 2}`;
            queryParams.push(startDate);
            queryParams.push(endDate);
        }

        const query = `
        WITH stats AS (
          SELECT 
            student_id,
            COUNT(*) FILTER (WHERE status = 'Present') as present_count,
            COUNT(*) FILTER (WHERE status = 'Absent') as absent_count,
            COUNT(*) FILTER (WHERE status = 'Leave') as leave_count,
            COUNT(*) FILTER (WHERE status = 'Late') as late_count,
            COUNT(*) as total_marked
          FROM attendance
          WHERE session_id = $1 AND school_id = $2 ${dateFilter}
          GROUP BY student_id
        )
        SELECT 
          s.id, s.name, s.admission_number, ss.roll_number,
          COALESCE(st.present_count, 0) as present,
          COALESCE(st.absent_count, 0) as absent,
          COALESCE(st.leave_count, 0) as leave,
          COALESCE(st.late_count, 0) as late,
          COALESCE(st.total_marked, 0) as total_days
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        LEFT JOIN stats st ON s.id = st.student_id
        WHERE ss.grade = $3 AND ss.section = $4 
          AND ss.session_id = $1 AND ss.school_id = $2
          AND ss.status = 'active'
        ORDER BY s.name
      `;

        const { rows } = await pool.query(query, queryParams);

        const report = rows.map(r => {
            const total = parseInt(r.total_days);
            const present = parseInt(r.present) + parseInt(r.late);
            const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
            return {
                studentId: r.id,
                name: r.name,
                admissionNumber: r.admission_number,
                rollNumber: r.roll_number,
                present: r.present,
                absent: r.absent,
                leave: r.leave,
                late: r.late,
                total: total,
                percentage: percentage + '%'
            };
        });

        res.json(report);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch attendance summary' });
    }
});

router.get('/api/attendance', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    const { date, classId, sessionId } = req.query;

    if (!date || !classId) return res.status(400).json({ message: 'Date and Class ID required' });

    try {
        const targetSessionId = sessionId as string;
        if (!targetSessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const classRow = await pool.query('SELECT grade, section FROM classes WHERE id = $1', [classId]);
        if (classRow.rows.length === 0) return res.status(404).json({ message: 'Class not found' });
        const { grade, section } = classRow.rows[0];

        const query = `
        SELECT 
          s.id as "studentId", s.name, s.admission_number as "admissionNumber", ss.roll_number as "rollNumber",
          a.status
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $3 AND a.session_id = $4
        WHERE ss.grade = $1 AND ss.section = $2
          AND ss.session_id = $4 AND ss.school_id = $5
          AND ss.status = 'active'
        ORDER BY ss.roll_number ASC, s.name ASC
      `;

        const { rows } = await pool.query(query, [grade, section, date, targetSessionId, user.schoolId]);

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch attendance' });
    }
});

router.get('/api/attendance/absent', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    if (!user.schoolId) return res.status(400).json({ message: "School ID required" });

    const { date: reportDate, sessionId } = req.query;
    if (!reportDate) return res.status(400).json({ message: "Date is required" });

    try {
        const query = `
        SELECT 
          s.name as student_name,
          s.admission_number,
          s.father_name,
          s.mobile_number,
          ss.grade,
          ss.section,
          ss.roll_number,
          a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE a.school_id = $1
          AND a.date = $2
          AND a.status IN ('Absent', 'Leave')
          AND ss.session_id = $3
        ORDER BY ss.grade, ss.section, s.name
      `;

        const targetSessionId = sessionId as string;
        if (!targetSessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const { rows } = await pool.query(query, [user.schoolId, reportDate, targetSessionId]);
        res.json(rows.map(row => ({
            name: row.student_name,
            admissionNumber: row.admission_number,
            fatherName: row.father_name,
            mobileNumber: row.mobile_number,
            className: `${row.grade}-${row.section}`,
            rollNumber: row.roll_number,
            status: row.status
        })));
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch absentee list' });
    }
});

router.post('/api/attendance', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    const { date, classId, records, sessionId } = req.body;

    if (!date || !records || !Array.isArray(records)) return res.status(400).json({ message: 'Invalid payload' });

    if (!sessionId) {
        return res.status(400).json({ message: 'sessionId is required' });
    }

    const client = await pool.connect();
    try {

        await client.query('BEGIN');

        for (const rec of records) {
            const id = genId();
            await client.query(`
          INSERT INTO attendance (id, student_id, date, status, session_id, marked_by, school_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (student_id, date) 
          DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = now()
        `, [id, rec.studentId, date, rec.status, sessionId, user.id, user.schoolId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Attendance saved' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Failed to save attendance' });
    } finally {
        client.release();
    }
});

router.get('/api/attendance/stats', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    const { sessionId } = req.query;

    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    try {
        const query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'Present') as present_count,
          COUNT(*) as total_marked
        FROM attendance
        WHERE school_id = $1 AND session_id = $2
      `;

        const { rows } = await pool.query(query, [user.schoolId, sessionId]);
        const stats = rows[0];
        const total = parseInt(stats.total_marked || '0');
        const present = parseInt(stats.present_count || '0');

        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

        res.json({ averageAttendance: parseFloat(percentage) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch attendance stats' });
    }
});

export const attendanceRouter = router;
