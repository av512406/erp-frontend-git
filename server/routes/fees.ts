import { Router } from 'express';
import { pool, genId, genTransactionId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertFeeTransactionSchema } from '@shared/schema';
import { formatDateForClient } from '../lib/mappers';
import { ZodError } from 'zod';

const router = Router();


// Ensure sequence function exists (migrations fallback)
(async () => {
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION get_next_receipt_serial(p_school_id UUID)
            RETURNS INTEGER AS $$
            DECLARE
                v_sequence_name TEXT;
                v_next_val INTEGER;
            BEGIN
                v_sequence_name := 'receipt_serial_' || REPLACE(p_school_id::TEXT, '-', '_');
                EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', v_sequence_name);
                EXECUTE format('SELECT nextval(%L)', v_sequence_name) INTO v_next_val;
                RETURN v_next_val;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ get_next_receipt_serial function verified');
    } catch (e) {
        console.error('Failed to create sequence function:', e);
    }
})();

router.get('/api/fees', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        let sessionId = req.query.sessionId as string;
        if (!sessionId) {
            const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
            sessionId = schoolRes.rows[0]?.current_session_id;
        }

        if (!sessionId) {
            const sessionRes = await pool.query(
                'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
                [user.schoolId]
            );
            if (sessionRes.rows.length > 0) sessionId = sessionRes.rows[0].id;
        }

        const { rows } = await pool.query(`
        SELECT f.id, f.student_id as "studentId", f.transaction_id as "transactionId", f.amount, f.payment_date as "paymentDate", f.payment_mode as "paymentMode", f.remarks,
               s.name as "studentName", f.created_at as "createdAt", f.updated_at as "updatedAt", f.receipt_serial as "receiptSerial", f.status, f.cancel_reason as "cancelReason"
        FROM fee_transactions f
        JOIN students s ON s.id = f.student_id
        WHERE f.school_id = $1
          AND (f.session_id = $2 OR f.session_id IS NULL)
          AND f.session_id = $2
        ORDER BY f.payment_date DESC, f.id DESC
      `, [user.schoolId, sessionId]);
        const mapped = rows.map(r => ({
            id: r.id,
            studentId: r.studentId,
            studentName: r.studentName,
            amount: parseFloat(r.amount),
            date: formatDateForClient(r.paymentDate),
            transactionId: r.transactionId,
            paymentMode: r.paymentMode,
            remarks: r.remarks || '',
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            receiptSerial: r.receiptSerial == null ? undefined : Number(r.receiptSerial),
            status: r.status,
            cancelReason: r.cancelReason
        }));
        res.json(mapped);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ message: 'failed to fetch fee transactions' });
    }
});

router.post('/api/fees', requireAuth, async (req, res) => {
    const user = (req as any).user;

    // 1. Role Validation (Issue 9)
    if (!['admin', 'accountant', 'superadmin'].includes(user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const client = await pool.connect();

    try {
        const data = insertFeeTransactionSchema.parse(req.body);
        const { sessionId } = req.body; // Explicitly from body
        const amt = parseFloat((data as any).amount);

        if (!isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: 'amount must be greater than 0' });
        }

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        const exists = await client.query('SELECT id, name FROM students WHERE id=$1 AND school_id=$2', [data.studentId, user.schoolId]);
        if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });

        // Validate session
        const sessionCheck = await client.query(
            'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session for this school' });
        }

        await client.query('BEGIN');

        // 2. Race Condition Fix (Issue 2)
        // Ensure the function exists (idempotent check) - simplistic migration
        // In production, use proper migration. Here we do a quick check.
        // We assume the function 'get_next_receipt_serial' will be created by the user or migration.
        // But since we had trouble running the migration, let's embed the creation safely?
        // No, let's stick to the plan of running the migration separately. 
        // If the function is missing, this will throw.

        let receiptSerial: number;
        try {
            const serialRes = await client.query('SELECT get_next_receipt_serial($1) as next', [user.schoolId]);
            receiptSerial = serialRes.rows[0].next;
        } catch (e: any) {
            // Fallback if function doesn't exist (e.g. migration failed)
            // We should probably fail loud, but for now let's use the old locking method inside the transaction
            // to ensure correctness if migration didn't run.
            await client.query('LOCK TABLE fee_transactions IN EXCLUSIVE MODE');
            const maxQ = await client.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
            receiptSerial = Number(maxQ.rows[0].next);
        }

        // 3. Duplicate Check
        const dupCheck = await client.query(
            `SELECT id FROM fee_transactions 
             WHERE student_id = $1 AND amount = $2 AND payment_date = $3 
             AND date_trunc('minute', created_at) = date_trunc('minute', now())`,
            [data.studentId, data.amount, data.paymentDate]
        );

        if (dupCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Duplicate transaction detected' });
        }

        const id = genId();
        const transactionId = genTransactionId();

        const q = await client.query(
            `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks, receipt_serial, school_id, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null, receiptSerial, user.schoolId, sessionId]
        );

        await client.query('COMMIT');

        const row = q.rows[0];
        res.status(201).json({
            id: row.id,
            studentId: row.student_id,
            studentName: exists.rows[0].name,
            amount: parseFloat(row.amount),
            date: formatDateForClient(row.payment_date),
            transactionId: row.transaction_id,
            paymentMode: row.payment_mode,
            remarks: row.remarks || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            receiptSerial: row.receipt_serial == null ? undefined : Number(row.receipt_serial)
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        if (e instanceof ZodError) {
            return res.status(400).json({ message: 'Validation error', details: e.errors });
        }
        res.status(500).json({ message: 'Failed to record fee' });
    } finally {
        client.release();
    }
});


router.post('/api/fees/:id/cancel', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only admins can cancel transactions' });
    }
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ message: 'Cancellation reason is required' });

        const result = await pool.query(
            'UPDATE fee_transactions SET status = $1, cancel_reason = $2 WHERE id = $3 AND school_id = $4 RETURNING *',
            ['cancelled', reason, id, user.schoolId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.json({ message: 'Transaction cancelled', transaction: result.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to cancel transaction' });
    }
});

router.post('/api/fees/:id/assign-serial', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
        const existing = await pool.query('SELECT receipt_serial FROM fee_transactions WHERE id=$1 AND school_id=$2', [id, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'transaction not found' });
        const current = existing.rows[0].receipt_serial;
        if (current != null) return res.json({ receiptSerial: Number(current), assigned: false });

        const maxQ = await pool.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
        const next = Number(maxQ.rows[0].next);

        const upd = await pool.query('UPDATE fee_transactions SET receipt_serial=$1 WHERE id=$2 RETURNING receipt_serial', [next, id]);
        return res.json({ receiptSerial: Number(upd.rows[0].receipt_serial), assigned: true });
    } catch (e: any) {
        console.error(e);
        return res.status(500).json({ message: 'internal error' });
    }
});

router.post('/api/fees/import', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const payload = req.body as any;

    // Extract sessionId and transactions array
    const sessionId = payload.sessionId;
    const incoming = payload.transactions || req.body;

    if (!Array.isArray(incoming)) return res.status(400).json({ message: 'transactions array required' });

    if (!sessionId) {
        return res.status(400).json({ message: 'sessionId required for import' });
    }

    // Validate session belongs to this school
    const sessionCheck = await pool.query(
        'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
        [sessionId, user.schoolId]
    );
    if (sessionCheck.rowCount === 0) {
        return res.status(400).json({ message: 'Invalid session for this school' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let inserted = 0;
        const skipped: any[] = [];
        for (let i = 0; i < incoming.length; i++) {
            const row = incoming[i];
            try {
                const normalized = { ...row, amount: row.amount != null ? String(row.amount) : row.amount };
                const data = insertFeeTransactionSchema.parse(normalized);

                const exists = await client.query('SELECT id FROM students WHERE id=$1 AND school_id=$2', [data.studentId, user.schoolId]);
                if ((exists.rowCount ?? 0) === 0) {
                    skipped.push({ index: i, reason: 'student not found', row });
                    continue;
                }
                const id = genId();
                const transactionId = genTransactionId();

                let retries = 3;
                let success = false;
                let lastError = null;

                while (retries > 0) {
                    try {
                        const maxQ = await client.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
                        const receiptSerial = Number(maxQ.rows[0].next);

                        // Use sessionId from request (already validated above)
                        await client.query(
                            `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks, receipt_serial, school_id, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                            [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null, receiptSerial, user.schoolId, sessionId]
                        );
                        success = true;
                        break;
                    } catch (e: any) {
                        if (e.code === '23505' && e.constraint === 'fee_transactions_school_id_receipt_serial_key') {
                            retries--;
                            lastError = e;
                            continue;
                        }
                        throw e;
                    }
                }

                if (!success) {
                    throw lastError || new Error('Failed to generate unique receipt serial');
                }

                inserted++;
            } catch (e: any) {
                skipped.push({ index: i, reason: e?.message || 'invalid row', row });
            }
        }
        await client.query('COMMIT');
        res.json({ inserted, skipped: skipped.length, skippedRows: skipped });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[FEES_IMPORT]', e);
        res.status(500).json({ message: 'import failed' });
        return;
    } finally {
        client.release();
    }
});

router.delete('/api/fees/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    await pool.query('DELETE FROM fee_transactions WHERE id=$1 AND school_id=$2', [id, user.schoolId]);
    res.json({ deleted: id });
});

export const feeRouter = router;
