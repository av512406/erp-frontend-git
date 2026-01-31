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

// Get payment history for a specific staff member
router.get('/api/staff-payments/:staffId', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { staffId } = req.params;

        // Verify staff belongs to this school
        const staffCheck = await pool.query(
            'SELECT id, name, monthly_salary FROM staff WHERE id = $1 AND school_id = $2',
            [staffId, user.schoolId]
        );

        if (staffCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        // Fetch all payments for this staff member
        const { rows } = await pool.query(`
      SELECT * FROM staff_payments 
      WHERE staff_id = $1 AND school_id = $2
      ORDER BY payment_date DESC, created_at DESC
    `, [staffId, user.schoolId]);

        const payments = rows.map(r => ({
            ...r,
            amount: parseFloat(r.amount)
        }));

        res.json({
            staff: {
                id: staffCheck.rows[0].id,
                name: staffCheck.rows[0].name,
                baseSalary: parseFloat(staffCheck.rows[0].monthly_salary)
            },
            payments
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch payment history' });
    }
});

// Get all staff with payment summary (staff-centric view)
router.get('/api/staff-salary-summary', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        // Fetch all staff
        const staffRes = await pool.query(`
      SELECT s.id, s.name, s.monthly_salary, s.phone, s.position, s.email
      FROM staff s 
      WHERE s.school_id = $1 AND s.status = 'active'
      ORDER BY s.name
    `, [user.schoolId]);

        // Fetch payment totals and last payment for current year
        const currentYear = new Date().getFullYear();

        const summary = await Promise.all(staffRes.rows.map(async (s: any) => {
            // Get total payments this year
            const ytdRes = await pool.query(`
        SELECT SUM(amount) as total, MAX(payment_date) as last_payment
        FROM staff_payments
        WHERE staff_id = $1 AND school_id = $2 AND year = $3
      `, [s.id, user.schoolId, currentYear.toString()]);

            const ytdTotal = parseFloat(ytdRes.rows[0]?.total || '0');
            const lastPayment = ytdRes.rows[0]?.last_payment;

            return {
                id: s.id,
                name: s.name,
                baseSalary: parseFloat(s.monthly_salary),
                ytdTotal,
                lastPaymentDate: lastPayment,
                position: s.position,
                phone: s.phone,
                email: s.email
            };
        }));

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

// --- Finance Transactions (Combined View) ---

router.get('/api/finance/transactions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { date: dateParam, sessionId } = req.query;

        if (!dateParam) {
            return res.status(400).json({ message: 'Date parameter is required' });
        }

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId required' });
        }

        // Validate session
        const sessionCheck = await pool.query(
            'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session' });
        }

        // Fetch active fee transactions for the date - FILTERED BY SESSION
        const feeQuery = `
            SELECT 
                f.id,
                f.transaction_id as "transactionId",
                f.amount,
                f.payment_date as "paymentDate",
                f.payment_mode as "paymentMode",
                f.remarks,
                f.receipt_serial as "receiptSerial",
                f.created_at as "createdAt",
                s.name as "studentName",
                'income' as type
            FROM fee_transactions f
            JOIN students s ON s.id = f.student_id
            WHERE f.school_id = $1 
                AND f.session_id = $3
                AND f.status = 'active'
                AND f.payment_date = $2
            ORDER BY f.created_at DESC
        `;

        // Fetch expenses for the date
        const expenseQuery = `
            SELECT 
                e.id,
                e.description,
                e.amount,
                e.date as "paymentDate",
                e.payment_method as "paymentMode",
                e.category,
                e.created_at as "createdAt",
                'expense' as type
            FROM expenses e
            WHERE e.school_id = $1 
                AND e.date = $2
            ORDER BY e.created_at DESC
        `;

        // Fetch salary payments for the date
        const salaryQuery = `
            SELECT 
                sp.id,
                sp.amount,
                sp.payment_date as "paymentDate",
                sp.remarks,
                sp.created_at as "createdAt",
                st.name as "staffName",
                sp.month,
                sp.year,
                'expense' as type
            FROM staff_payments sp
            JOIN staff st ON st.id = sp.staff_id
            WHERE sp.school_id = $1 
                AND sp.payment_date = $2
            ORDER BY sp.created_at DESC
        `;

        const [feeRes, expRes, salRes] = await Promise.all([
            pool.query(feeQuery, [user.schoolId, dateParam, sessionId]),
            pool.query(expenseQuery, [user.schoolId, dateParam]),
            pool.query(salaryQuery, [user.schoolId, dateParam])
        ]);

        // Map fee transactions
        const feeTransactions = feeRes.rows.map(r => ({
            id: r.id,
            type: 'income' as const,
            description: `Fee Payment - ${r.studentName}`,
            studentName: r.studentName,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            remarks: r.remarks || '',
            transactionId: r.transactionId,
            receiptSerial: r.receiptSerial,
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        // Map expenses
        const expenses = expRes.rows.map(r => ({
            id: r.id,
            type: 'expense' as const,
            description: r.description,
            category: r.category,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        // Map salary payments
        const salaries = salRes.rows.map(r => ({
            id: r.id,
            type: 'expense' as const,
            description: `Salary - ${r.staffName} (${r.month} ${r.year})`,
            staffName: r.staffName,
            amount: parseFloat(r.amount),
            paymentMode: 'Bank Transfer',
            remarks: r.remarks || '',
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        // Combine and sort by creation time
        const allTransactions = [...feeTransactions, ...expenses, ...salaries]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json(allTransactions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch transactions' });
    }
});

// --- Finance Stats / Dashboard ---

router.get('/api/finance/stats', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        // CRITICAL: Session isolation - stats must be session-specific
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId required' });
        }

        // Validate session belongs to this school
        const sessionCheck = await pool.query(
            'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session for this school' });
        }

        const { date: dateParam, month, year, startDate, endDate } = req.query;

        let dateFilterFee = '';
        let dateFilterExp = '';
        let dateFilterSal = '';
        const paramsFee: any[] = [user.schoolId, sessionId]; // Add sessionId as param 2
        const paramsExp: any[] = [user.schoolId];
        const paramsSal: any[] = [user.schoolId];

        // Helper to add param
        const pFee = (val: any) => { paramsFee.push(val); return `$${paramsFee.length}`; };
        const pExp = (val: any) => { paramsExp.push(val); return `$${paramsExp.length}`; };
        const pSal = (val: any) => { paramsSal.push(val); return `$${paramsSal.length}`; };

        if (dateParam) {
            dateFilterFee = `AND f.payment_date = ${pFee(dateParam)}`;
            dateFilterExp = `AND e.date = ${pExp(dateParam)}`;
            dateFilterSal = `AND sp.payment_date = ${pSal(dateParam)}`;
        } else if (month && year) {
            dateFilterFee = `AND EXTRACT(MONTH FROM f.payment_date) = ${pFee(month)} AND EXTRACT(YEAR FROM f.payment_date) = ${pFee(year)}`;
            dateFilterExp = `AND EXTRACT(MONTH FROM e.date) = ${pExp(month)} AND EXTRACT(YEAR FROM e.date) = ${pExp(year)}`;
            dateFilterSal = `AND EXTRACT(MONTH FROM sp.payment_date) = ${pSal(month)} AND EXTRACT(YEAR FROM sp.payment_date) = ${pSal(year)}`;
        } else if (startDate && endDate) {
            dateFilterFee = `AND f.payment_date BETWEEN ${pFee(startDate)} AND ${pFee(endDate)}`;
            dateFilterExp = `AND e.date BETWEEN ${pExp(startDate)} AND ${pExp(endDate)}`;
            dateFilterSal = `AND sp.payment_date BETWEEN ${pSal(startDate)} AND ${pSal(endDate)}`;
        }

        // Fee Collection - FILTERED BY SESSION
        const feeQuery = `
      SELECT SUM(amount) as total 
      FROM fee_transactions f
      WHERE f.school_id = $1 
      AND f.session_id = $2
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

        // Note: dateFilterSal, paramsSal, and pSal are already defined above in the stats endpoint

        if (dateParam && !dateFilterSal) {
            dateFilterSal = `AND s.payment_date = ${pSal(dateParam)}`;
        } else if (month && year) {
            dateFilterSal = `AND s.year = ${pSal(year)} AND s.month = ${pSal(month)}`; // or payment_date extract
            // Staff payments table has month/year columns, but also payment_date. 
            // If filtering by "Jan 2025" stats, we usually mean payments FOR Jan or payments MADE IN Jan?
            // For now using the month/year fields.
        } else if (startDate && endDate) {
            dateFilterSal = `AND s.payment_date BETWEEN ${pSal(startDate)} AND ${pSal(endDate)}`;
        }

        // Similar for months but need conversion or best is payment_date.
        // Ideally: if filtering by month, use payment_date >= '2025-01-01' AND payment_date < '2025-02-01'
        if (month && year) {
            // Reset params for this block if we want to use payment_date extract same as others
            // Or just rely on input. 
            // Let's stick to payment_date for cash stats.
            // Re-building filter for salary based on payment_date
            dateFilterSal = `AND EXTRACT(MONTH FROM s.payment_date) = ${pSal(month)} AND EXTRACT(YEAR FROM s.payment_date) = ${pSal(year)}`;
        }


        const salQuery = `
      SELECT SUM(amount) as total
      FROM staff_payments sp
      WHERE sp.school_id = $1
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

// --- PDF Generation for Transactions ---

router.get('/api/finance/transactions/pdf', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { date: dateParam, startDate, endDate, sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId required' });
        }

        // Validate session
        const sessionCheck = await pool.query(
            'SELECT id, name FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session' });
        }
        const sessionName = sessionCheck.rows[0].name;

        // Fetch school info
        const schoolRes = await pool.query('SELECT name, address, phone FROM schools WHERE id = $1', [user.schoolId]);
        const school = schoolRes.rows[0];

        // Create specific params for each query to avoid bind errors
        // feeQuery uses all params ($1..$N including sessionId)
        // expenseQuery/salaryQuery might NOT use sessionId (last param usually) if they are date-based only.
        // Actually, let's rebuild params efficiently.

        // Fee params: [schoolId, ...dates, sessionId]
        // Expense/Salary params: [schoolId, ...dates] -> NO sessionId

        // Construct distinct param arrays
        const commonParams = [user.schoolId];
        let epIdx = 2;

        let reportTitle = '';
        let reportPeriod = '';

        let dateFilterFeeStr = '';
        let dateFilterExpStr = '';
        let dateFilterSalStr = '';

        if (startDate && endDate) {
            commonParams.push(startDate, endDate);
            dateFilterFeeStr = `AND f.payment_date BETWEEN $2 AND $3`;
            dateFilterExpStr = `AND e.date BETWEEN $2 AND $3`;
            dateFilterSalStr = `AND sp.payment_date BETWEEN $2 AND $3`;
            reportTitle = 'Financial Statement';
            reportPeriod = `${new Date(startDate as string).toLocaleDateString('en-IN')} to ${new Date(endDate as string).toLocaleDateString('en-IN')}`;
            epIdx += 2;
        } else if (dateParam) {
            commonParams.push(dateParam);
            dateFilterFeeStr = `AND f.payment_date = $2`;
            dateFilterExpStr = `AND e.date = $2`;
            dateFilterSalStr = `AND sp.payment_date = $2`;
            reportTitle = 'Daily Transaction Report';
            reportPeriod = new Date(dateParam as string).toLocaleDateString('en-IN', { dateStyle: 'long' });
            epIdx += 1;
        } else {
            reportTitle = 'Session Financial Statement';
            reportPeriod = `Academic Session: ${sessionName}`;
        }

        // Fee params needs sessionId appended
        const feeParams = [...commonParams, sessionId];
        const sessionIdPlaceholder = `$${feeParams.length}`;

        // Fetch transactions
        const feeQuery = `
            SELECT 
                f.id,
                f.transaction_id as "transactionId",
                f.amount,
                f.payment_date as "paymentDate",
                f.payment_mode as "paymentMode",
                f.remarks,
                f.receipt_serial as "receiptSerial",
                f.created_at as "createdAt",
                s.name as "studentName",
                'income' as type
            FROM fee_transactions f
            JOIN students s ON s.id = f.student_id
            WHERE f.school_id = $1 
                AND f.session_id = ${sessionIdPlaceholder}
                AND f.status = 'active'
                ${dateFilterFeeStr}
            ORDER BY f.payment_date DESC, f.created_at DESC
        `;

        const expenseQuery = `
            SELECT 
                e.id,
                e.description,
                e.amount,
                e.date as "paymentDate",
                e.payment_method as "paymentMode",
                e.category,
                e.created_at as "createdAt",
                'expense' as type
            FROM expenses e
            WHERE e.school_id = $1 
                ${dateFilterExpStr}
            ORDER BY e.date DESC, e.created_at DESC
        `;

        const salaryQuery = `
            SELECT 
                sp.id,
                sp.amount,
                sp.payment_date as "paymentDate",
                sp.remarks,
                sp.created_at as "createdAt",
                st.name as "staffName",
                sp.month,
                sp.year,
                'expense' as type
            FROM staff_payments sp
            JOIN staff st ON st.id = sp.staff_id
            WHERE sp.school_id = $1 
                ${dateFilterSalStr}
            ORDER BY sp.payment_date DESC, sp.created_at DESC
        `;

        const [feeRes, expRes, salRes] = await Promise.all([
            pool.query(feeQuery, feeParams),
            pool.query(expenseQuery, commonParams),
            pool.query(salaryQuery, commonParams)
        ]);

        const feeTransactions = feeRes.rows.map(r => ({
            id: r.id,
            type: 'income',
            description: `Fee: ${r.studentName}`,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            transactionId: r.transactionId,
            receiptSerial: r.receiptSerial,
            createdAt: r.createdAt,
            date: new Date(r.paymentDate)
        }));

        const expenses = expRes.rows.map(r => ({
            id: r.id,
            type: 'expense',
            description: `Exp: ${r.description}`,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            createdAt: r.createdAt,
            date: new Date(r.paymentDate)
        }));

        const salaries = salRes.rows.map(r => ({
            id: r.id,
            type: 'expense',
            description: `Salary: ${r.staffName} (${r.month})`,
            amount: parseFloat(r.amount),
            paymentMode: 'Bank Transfer',
            createdAt: r.createdAt,
            date: new Date(r.paymentDate)
        }));

        // Combine and sort chronologically (oldest first for statement running balance)
        const allTransactions = [...feeTransactions, ...expenses, ...salaries]
            .sort((a, b) => a.date.getTime() - b.date.getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Calculate totals
        const totalIncome = feeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = [...expenses, ...salaries].reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalIncome - totalExpense;

        // Generate HTML with Statement Table
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; }
        .header p { margin: 5px 0; color: #666; font-size: 14px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
        .summary-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
        .stat-label { display: block; font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 5px; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .pos { color: #10b981; }
        .neg { color: #ef4444; }
        .neu { color: #3b82f6; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1f2937; color: white; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        
        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${school?.name || 'School Name'}</h1>
        <p>${school?.address || 'Address Line 1'}</p>
        <p>${school?.phone || 'Phone Contact'}</p>
    </div>

    <div class="meta">
        <div>
            <strong>Report:</strong> ${reportTitle}<br>
            <strong>Session:</strong> ${sessionName}
        </div>
        <div style="text-align: right;">
            <strong>Period:</strong> ${reportPeriod}<br>
            <strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })} ${new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })}
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-grid">
            <div>
                <span class="stat-label">Total Credits</span>
                <span class="stat-value pos">₹${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
                <span class="stat-label">Total Debits</span>
                <span class="stat-value neg">₹${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
                <span class="stat-label">Net Balance</span>
                <span class="stat-value ${netBalance >= 0 ? 'pos' : 'neg'}">₹${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 15%">Date</th>
                <th style="width: 40%">Description</th>
                <th style="width: 15%">Mode</th>
                <th style="width: 15%" class="text-right">Credit</th>
                <th style="width: 15%" class="text-right">Debit</th>
            </tr>
        </thead>
        <tbody>
            ${allTransactions.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #666;">No transactions found for this period.</td></tr>' : ''}
            ${allTransactions.map(t => `
            <tr>
                <td>${t.date.toLocaleDateString('en-IN')}</td>
                <td>
                    <div class="font-bold">${t.description}</div>
                    <div style="font-size: 10px; color: #666;">
                        ${'receiptSerial' in t && t.receiptSerial ? `RCPT #${t.receiptSerial}` : ''} 
                        ${'transactionId' in t && t.transactionId ? `TXN: ${t.transactionId}` : ''}
                    </div>
                </td>
                <td>${t.paymentMode || '-'}</td>
                <td class="text-right pos">${t.type === 'income' ? `₹${t.amount.toLocaleString('en-IN')}` : '-'}</td>
                <td class="text-right neg">${t.type === 'expense' ? `₹${t.amount.toLocaleString('en-IN')}` : '-'}</td>
            </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr style="background: #e5e7eb; font-weight: bold;">
                <td colspan="3" class="text-right">Totals</td>
                <td class="text-right pos">₹${totalIncome.toLocaleString('en-IN')}</td>
                <td class="text-right neg">₹${totalExpense.toLocaleString('en-IN')}</td>
            </tr>
        </tfoot>
    </table>

    <div class="footer">
        <p>This is a computer-generated statement and requires no signature.</p>
    </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html');
        // Sanitized title for filename
        const safeTitle = reportTitle.toLowerCase().replace(/ /g, '-');
        res.setHeader('Content-Disposition', `inline; filename="${safeTitle}-${dateParam || 'statement'}.html"`);
        res.send(html);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to generate PDF' });
    }
});

router.get('/api/finance/statement-data', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { date: dateParam, startDate, endDate, sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId required' });
        }

        // Validate session
        const sessionCheck = await pool.query(
            'SELECT id, name FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [sessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid session' });
        }
        const sessionName = sessionCheck.rows[0].name;

        // Fetch school info
        const schoolRes = await pool.query('SELECT name, address, phone FROM schools WHERE id = $1', [user.schoolId]);
        const school = schoolRes.rows[0];

        // Construct params
        const commonParams = [user.schoolId];

        let reportTitle = '';
        let reportPeriod = '';

        let dateFilterFeeStr = '';
        let dateFilterExpStr = '';
        let dateFilterSalStr = '';

        if (startDate && endDate) {
            commonParams.push(startDate, endDate);
            dateFilterFeeStr = `AND f.payment_date BETWEEN $2 AND $3`;
            dateFilterExpStr = `AND e.date BETWEEN $2 AND $3`;
            dateFilterSalStr = `AND sp.payment_date BETWEEN $2 AND $3`;
            reportTitle = 'Financial Statement';
            reportPeriod = `${new Date(startDate as string).toLocaleDateString('en-IN')} to ${new Date(endDate as string).toLocaleDateString('en-IN')}`;
        } else if (dateParam) {
            commonParams.push(dateParam);
            dateFilterFeeStr = `AND f.payment_date = $2`;
            dateFilterExpStr = `AND e.date = $2`;
            dateFilterSalStr = `AND sp.payment_date = $2`;
            reportTitle = 'Daily Transaction Report';
            reportPeriod = new Date(dateParam as string).toLocaleDateString('en-IN', { dateStyle: 'long' });
        } else {
            reportTitle = 'Session Financial Statement';
            reportPeriod = `Academic Session: ${sessionName}`;
        }

        const feeParams = [...commonParams, sessionId];
        const sessionIdPlaceholder = `$${feeParams.length}`;

        // Fetch transactions
        const feeQuery = `
            SELECT 
                f.id,
                f.transaction_id as "transactionId",
                f.amount,
                f.payment_date as "paymentDate",
                f.payment_mode as "paymentMode",
                f.remarks,
                f.receipt_serial as "receiptSerial",
                f.created_at as "createdAt",
                s.name as "studentName",
                'income' as type
            FROM fee_transactions f
            JOIN students s ON s.id = f.student_id
            WHERE f.school_id = $1 
                AND f.session_id = ${sessionIdPlaceholder}
                AND f.status = 'active'
                ${dateFilterFeeStr}
            ORDER BY f.payment_date DESC, f.created_at DESC
        `;

        const expenseQuery = `
            SELECT 
                e.id,
                e.description,
                e.amount,
                e.date as "paymentDate",
                e.payment_method as "paymentMode",
                e.category,
                e.created_at as "createdAt",
                'expense' as type
            FROM expenses e
            WHERE e.school_id = $1 
                ${dateFilterExpStr}
            ORDER BY e.date DESC, e.created_at DESC
        `;

        const salaryQuery = `
            SELECT 
                sp.id,
                sp.amount,
                sp.payment_date as "paymentDate",
                sp.remarks,
                sp.created_at as "createdAt",
                st.name as "staffName",
                sp.month,
                sp.year,
                'expense' as type
            FROM staff_payments sp
            JOIN staff st ON st.id = sp.staff_id
            WHERE sp.school_id = $1 
                ${dateFilterSalStr}
            ORDER BY sp.payment_date DESC, sp.created_at DESC
        `;

        const [feeRes, expRes, salRes] = await Promise.all([
            pool.query(feeQuery, feeParams),
            pool.query(expenseQuery, commonParams),
            pool.query(salaryQuery, commonParams)
        ]);

        const feeTransactions = feeRes.rows.map(r => ({
            id: r.id,
            type: 'income',
            description: `Fee: ${r.studentName}`,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            transactionId: r.transactionId,
            receiptSerial: r.receiptSerial,
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        const expenses = expRes.rows.map(r => ({
            id: r.id,
            type: 'expense',
            description: `Exp: ${r.description}`,
            amount: parseFloat(r.amount),
            paymentMode: r.paymentMode,
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        const salaries = salRes.rows.map(r => ({
            id: r.id,
            type: 'expense',
            description: `Salary: ${r.staffName} (${r.month})`,
            amount: parseFloat(r.amount),
            paymentMode: 'Bank Transfer',
            createdAt: r.createdAt,
            date: r.paymentDate
        }));

        const allTransactions = [...feeTransactions, ...expenses, ...salaries]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const totalIncome = feeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = [...expenses, ...salaries].reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalIncome - totalExpense;

        res.json({
            school,
            reportTitle,
            reportPeriod,
            transactions: allTransactions,
            summary: {
                totalIncome,
                totalExpense,
                netBalance
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch statement data' });
    }
});

export const financeRouter = router;
