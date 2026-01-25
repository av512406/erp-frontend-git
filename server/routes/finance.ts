import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertExpenseSchema, insertStaffPaymentSchema } from '@shared/schema';

const router = Router();

// --- Expenses ---

router.get('/api/expenses', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { startDate, endDate, category } = req.query;

        let query = `
      SELECT e.*, u.name as "recordedByName" 
      FROM expenses e 
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE e.school_id = $1
    `;
        const params: any[] = [user.schoolId];
        let idx = 2;

        if (startDate) {
            query += ` AND e.date >= $${idx++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND e.date <= $${idx++}`;
            params.push(endDate);
        }
        if (category && category !== 'all') {
            query += ` AND e.category = $${idx++}`;
            params.push(category);
        }

        query += ` ORDER BY e.date DESC, e.created_at DESC`;

        const { rows } = await pool.query(query, params);

        // Parse amounts
        const mapped = rows.map(r => ({
            ...r,
            amount: parseFloat(r.amount)
        }));

        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch expenses' });
    }
});

router.post('/api/expenses', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertExpenseSchema.parse(req.body);
        const id = genId();

        const { rows } = await pool.query(
            `INSERT INTO expenses (id, description, amount, category, date, payment_method, receipt_url, recorded_by, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [id, data.description, data.amount, data.category, data.date, data.paymentMethod, data.receiptUrl, user.id, user.schoolId]
        );

        res.status(201).json({ ...rows[0], amount: parseFloat(rows[0].amount) });
    } catch (e: any) {
        if (e.name === 'ZodError') return res.status(400).json({ message: 'Validation error', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to add expense' });
    }
});

router.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND school_id = $2 RETURNING id', [id, user.schoolId]);

        if (result.rowCount === 0) return res.status(404).json({ message: 'Expense not found' });

        res.json({ message: 'Expense deleted', id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to delete expense' });
    }
});

// --- Staff Salary ---

router.get('/api/staff-salary-summary', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ message: 'Month and Year required' });

        // Fetch all staff (teachers)
        const teachersRes = await pool.query(`
      SELECT t.id, t.name, t.salary, t.qualification, t.mobile_number 
      FROM teachers t 
      WHERE t.school_id = $1
    `, [user.schoolId]);

        // Fetch payments for this month/year
        const paymentsRes = await pool.query(`
      SELECT * FROM staff_payments 
      WHERE school_id = $1 AND month = $2 AND year = $3
    `, [user.schoolId, month, year]);

        const paymentsMap = new Map();
        paymentsRes.rows.forEach(p => paymentsMap.set(p.staff_id, p));

        const summary = teachersRes.rows.map(t => {
            const payment = paymentsMap.get(t.id);
            return {
                id: t.id,
                name: t.name,
                baseSalary: parseFloat(t.salary),
                status: payment ? payment.status : 'Unpaid',
                payment: payment ? {
                    ...payment,
                    amount: parseFloat(payment.amount)
                } : null
            };
        });

        res.json(summary);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch salary summary' });
    }
});

router.post('/api/salary-payments', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertStaffPaymentSchema.parse(req.body);

        // Check if already paid
        const existing = await pool.query(`
      SELECT id FROM staff_payments 
      WHERE school_id = $1 AND staff_id = $2 AND month = $3 AND year = $4 AND status = 'Paid'
    `, [user.schoolId, data.staffId, data.month, data.year]);

        if (existing.rowCount! > 0) {
            return res.status(409).json({ message: 'Salary already paid for this month' });
        }

        const id = genId();
        const { rows } = await pool.query(
            `INSERT INTO staff_payments (id, staff_id, amount, month, year, payment_date, status, remarks, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [id, data.staffId, data.amount, data.month, data.year, data.paymentDate, data.status || 'Paid', data.remarks, user.schoolId]
        );

        res.status(201).json({ ...rows[0], amount: parseFloat(rows[0].amount) });
    } catch (e: any) {
        if (e.name === 'ZodError') return res.status(400).json({ message: 'Validation error', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'Failed to record salary payment' });
    }
});

// --- Finance Stats / Dashboard ---

router.get('/api/finance/stats', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        // Default to today if no date provided
        // Actually, client might send range. Let's support date range or single date.
        // If 'date' param -> specific day
        // If 'month'/'year' -> specific month

        const { date: dateParam, month, year, startDate, endDate } = req.query;

        let dateFilterFee = '';
        let dateFilterExp = '';
        const paramsFee: any[] = [user.schoolId];
        const paramsExp: any[] = [user.schoolId];

        // Helper to add param
        const pFee = (val: any) => { paramsFee.push(val); return `$${paramsFee.length}`; };
        const pExp = (val: any) => { paramsExp.push(val); return `$${paramsExp.length}`; };

        if (dateParam) {
            dateFilterFee = `AND f.payment_date = ${pFee(dateParam)}`;
            dateFilterExp = `AND e.date = ${pExp(dateParam)}`;
        } else if (month && year) {
            // Construct date range for month
            // Database stores dates, so let's just query extract month/year if possible or simpler logic
            // Postgres: EXTRACT(MONTH FROM date)
            dateFilterFee = `AND EXTRACT(MONTH FROM f.payment_date) = ${pFee(month)} AND EXTRACT(YEAR FROM f.payment_date) = ${pFee(year)}`;
            dateFilterExp = `AND EXTRACT(MONTH FROM e.date) = ${pExp(month)} AND EXTRACT(YEAR FROM e.date) = ${pExp(year)}`;
        } else if (startDate && endDate) {
            dateFilterFee = `AND f.payment_date BETWEEN ${pFee(startDate)} AND ${pFee(endDate)}`;
            dateFilterExp = `AND e.date BETWEEN ${pExp(startDate)} AND ${pExp(endDate)}`;
        }

        // Fee Collection (Cancel transactions handled: status != 'cancelled')
        // NOTE: If status is 'cancelled', we do NOT count it. user asked: "Canceling fee receipt should update the daily collection accordingly."
        // Assuming status column exists in fee_transactions as per prev schema.

        const feeQuery = `
      SELECT SUM(amount) as total 
      FROM fee_transactions f
      WHERE f.school_id = $1 
      AND f.status = 'active'
      ${dateFilterFee}
    `;

        // Expenses
        const expQuery = `
      SELECT SUM(amount) as total 
      FROM expenses e 
      WHERE e.school_id = $1
      ${dateFilterExp}
    `;

        // Staff Payments (Salary) - considered as Expense?
        // "We want to see -> Collection - Expenses"
        // Usually salaries are a major expense. Should we include them?
        // The prompt says "Expense management plus staff salary management".
        // Usually "Expenses" is operational. Net Balance should logically be Collection - (Expenses + Salaries).
        // Let's ask or assume. Usually for daily collection/expense, salaries (monthly) might distort daily graphs if not careful.
        // But for "Net Balance", it should definitely include salaries.
        // However, if we filter by *today*, salaries paid today should count.

        let dateFilterSal = '';
        const paramsSal: any[] = [user.schoolId];
        const pSal = (val: any) => { paramsSal.push(val); return `$${paramsSal.length}`; };

        if (dateParam) {
            dateFilterSal = `AND s.payment_date = ${pSal(dateParam)}`;
        } else if (month && year) {
            dateFilterSal = `AND s.year = ${pSal(year)} AND s.month = ${pSal(month)}`; // or payment_date extract
            // Staff payments table has month/year columns, but also payment_date. 
            // If filtering by "Jan 2025" stats, we usually mean payments FOR Jan or payments MADE IN Jan?
            // Usually CASHFLOW implies payments MADE IN that period.
            // Let's use payment_date for cashflow stats.
        } else if (startDate && endDate) {
            dateFilterSal = `AND s.payment_date BETWEEN ${pSal(startDate)} AND ${pSal(endDate)}`;
        }

        // Override date filter for salary to use payment_date always for consistency with cashflow
        if (month && year) {
            // Reset params for this block if we want to use payment_date extract same as others
            // Or just rely on input. 
            // Let's stick to payment_date for cash stats.
            // Re-building filter for salary based on payment_date
            dateFilterSal = `AND EXTRACT(MONTH FROM s.payment_date) = ${pSal(month)} AND EXTRACT(YEAR FROM s.payment_date) = ${pSal(year)}`;
        }


        const salQuery = `
      SELECT SUM(amount) as total
      FROM staff_payments s
      WHERE s.school_id = $1
      ${dateFilterSal}
    `;

        const [feeRes, expRes, salRes] = await Promise.all([
            pool.query(feeQuery, paramsFee),
            pool.query(expQuery, paramsExp),
            pool.query(salQuery, paramsSal)
        ]);

        const collection = parseFloat(feeRes.rows[0].total || '0');
        const expenses = parseFloat(expRes.rows[0].total || '0');
        const salaries = parseFloat(salRes.rows[0].total || '0');

        const totalExpenses = expenses + salaries;

        res.json({
            collection,
            operationalExpenses: expenses,
            salariesPaid: salaries,
            totalExpenses,
            netBalance: collection - totalExpenses
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch finance stats' });
    }
});

export const financeRouter = router;
