import { Router } from 'express';
import { pool, genId, genTransactionId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertFeeTransactionSchema } from '@shared/schema';
import { formatDateForClient } from '../lib/mappers';

const router = Router();

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
    try {
        const data = insertFeeTransactionSchema.parse(req.body);
        const amt = parseFloat((data as any).amount);
        if (!isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: 'amount must be greater than 0' });
        }

        const exists = await pool.query('SELECT id, name FROM students WHERE id=$1 AND school_id=$2', [data.studentId, user.schoolId]);
        if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });

        const id = genId();
        const transactionId = genTransactionId();

        let receiptSerial: number | null = null;
        let retries = 3;
        let lastError = null;
        let row = null;

        while (retries > 0) {
            try {
                const maxQ = await pool.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
                receiptSerial = Number(maxQ.rows[0].next);

                const sessionRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
                const sessionId = sessionRes.rows[0]?.current_session_id;

                let finalSessionId = sessionId;
                if (!finalSessionId) {
                    const activeRes = await pool.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
                    finalSessionId = activeRes.rows[0]?.id;
                }

                const q = await pool.query(
                    `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks, receipt_serial, school_id, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                    [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null, receiptSerial, user.schoolId, finalSessionId]
                );
                row = q.rows[0];
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

        if (!row) {
            throw lastError || new Error('Failed to generate unique receipt serial after retries');
        }

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
        if ((e as any).name === "ZodError") return res.status(400).json({ message: 'validation', issues: (e as any).format() });
        console.error(e);
        res.status(500).json({ message: 'internal error' });
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
    const incoming = req.body as any[];
    if (!Array.isArray(incoming)) return res.status(400).json({ message: 'transactions array required' });
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

                        const schoolQ = await client.query('SELECT current_session_id FROM schools WHERE id=$1', [user.schoolId]);
                        const sessionId = schoolQ.rows[0]?.current_session_id;

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
        console.error(e);
        res.status(500).json({ message: 'import failed' });
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
