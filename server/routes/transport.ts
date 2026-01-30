import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth, requireFeature } from '../middleware/auth';

const router = Router();

router.get('/api/transport/routes', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query('SELECT * FROM transport_routes WHERE school_id = $1 ORDER BY name', [user.schoolId]);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch transport routes' });
    }
});

router.post('/api/transport/routes', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { name, feeAmount, vehicleNumber } = req.body;
        if (!name || isNaN(feeAmount)) return res.status(400).json({ message: 'Invalid data' });

        const id = genId();
        const q = await pool.query(
            'INSERT INTO transport_routes (id, name, fee_amount, vehicle_number, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, name, feeAmount, vehicleNumber, user.schoolId]
        );
        res.json(q.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to create route' });
    }
});

router.put('/api/transport/routes/:id', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { id } = req.params;
        const { name, feeAmount, vehicleNumber } = req.body;

        const q = await pool.query(
            'UPDATE transport_routes SET name = $1, fee_amount = $2, vehicle_number = $3, updated_at = now() WHERE id = $4 AND school_id = $5 RETURNING *',
            [name, feeAmount, vehicleNumber, id, user.schoolId]
        );

        if (q.rowCount === 0) return res.status(404).json({ message: 'Route not found' });
        res.json(q.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to update route' });
    }
});

router.put('/api/transport/records/:id', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { id } = req.params;
        const { yearlyFee, transportType } = req.body;

        const q = await pool.query(
            'UPDATE transport_records SET yearly_fee = $1, transport_type = $2, updated_at = now() WHERE id = $3 AND school_id = $4 RETURNING *',
            [yearlyFee, transportType, id, user.schoolId]
        );

        if (q.rowCount === 0) return res.status(404).json({ message: 'Record not found' });
        res.json(q.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to update transport record' });
    }
});

router.post('/api/transport/assign', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
        const { studentId, transportType, yearlyFee, sessionId } = req.body;

        if (!transportType || yearlyFee === undefined) {
            return res.status(400).json({ message: 'Transport Type and Yearly Fee are required' });
        }

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        // Validate session belongs to school
        const sessionCheck = await client.query(
            'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session for this school' });
        }

        await client.query('BEGIN');

        const id = genId();
        await client.query(`
        INSERT INTO student_transport (id, student_id, transport_type, yearly_fee, session_id, school_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, session_id) 
        DO UPDATE SET transport_type = EXCLUDED.transport_type, yearly_fee = EXCLUDED.yearly_fee, updated_at = now()
      `, [id, studentId, transportType, yearlyFee, sessionId, user.schoolId]);

        await client.query('COMMIT');
        res.json({ message: 'Student assigned to transport' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Failed to assign transport' });
    } finally {
        client.release();
    }
});

router.get('/api/transport/students', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;

    try {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        let query = `
        WITH paid_fees AS (
          SELECT student_id, SUM(amount) as total_paid
          FROM transport_fee_transactions
          WHERE school_id = $1 AND session_id = $2
          GROUP BY student_id
        )
        SELECT 
          st.id as transport_record_id,
          st.transport_type,
          st.yearly_fee,
          s.id as student_id,
          s.name as student_name,
          s.admission_number,
          s.father_name,
          ss.grade,
          ss.section,
          COALESCE(pf.total_paid, 0) as total_paid
        FROM student_transport st
        JOIN students s ON st.student_id = s.id
        JOIN student_sessions ss ON s.id = ss.student_id AND ss.session_id = st.session_id
        LEFT JOIN paid_fees pf ON st.student_id = pf.student_id
        WHERE st.school_id = $1 AND st.session_id = $2
        ORDER BY s.name
      `;

        const { rows } = await pool.query(query, [user.schoolId, sessionId]);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch transport students' });
    }
});

router.post('/api/transport/pay', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
        const { studentId, amount, paymentDate, remarks, sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const id = genId();
        await pool.query(
            'INSERT INTO transport_fee_transactions (id, student_id, amount, payment_date, remarks, session_id, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, studentId, amount, paymentDate, remarks, sessionId, user.schoolId]
        );

        res.json({ message: 'Payment recorded successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to record payment' });
    }
});

router.get('/api/transport/students/:studentId/transactions', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    const { studentId } = req.params;

    try {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const { rows } = await pool.query(`
            SELECT id, amount, payment_date, remarks, created_at
            FROM transport_fee_transactions
            WHERE student_id = $1 AND school_id = $2 AND session_id = $3
            ORDER BY payment_date DESC, created_at DESC
        `, [studentId, user.schoolId, sessionId]);

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch transactions' });
    }
});

export const transportRouter = router;
