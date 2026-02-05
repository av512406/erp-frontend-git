import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router = Router();

function escapeCsv(value: string) {
    if (value == null) return '';
    const needsQuotes = /[",\n]/.test(value);
    let v = value.replace(/"/g, '""');
    return needsQuotes ? '"' + v + '"' : v;
}

function escapeHtml(value: string) {
    if (value == null) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

router.get('/api/export/students/csv', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query("SELECT * FROM students WHERE (status <> 'left' OR status IS NULL) AND school_id = $1 ORDER BY admission_number", [user.schoolId]);
        const header = ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount'];
        const csvRows = rows.map(r => [
            r.admission_number,
            escapeCsv(r.name),
            escapeCsv(r.father_name || ''),
            escapeCsv(r.mother_name || ''),
            r.date_of_birth,
            r.admission_date,
            escapeCsv(r.aadhar_number || ''),
            escapeCsv(r.pen_number || ''),
            escapeCsv(r.aapar_id || ''),
            escapeCsv(r.mobile_number || ''),
            escapeCsv(r.address || ''),
            escapeCsv(r.grade || ''),
            escapeCsv(r.section || ''),
            r.yearly_fee_amount?.toString?.() ?? r.yearly_fee_amount
        ].join(','));
        const csv = [header.join(','), ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="students-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to export students' });
    }
});

router.get('/api/export/students/excel', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const rawCols = (req.query.cols as string | undefined) || '';
        const requested = rawCols.split(',').map(c => c.trim()).filter(Boolean);
        const allowedMap: Record<string, { header: string; expr: string; transform?: (v: any) => any }> = {
            admissionNumber: { header: 'Admission Number', expr: 's.admission_number' },
            name: { header: 'Name', expr: 's.name' },
            fatherName: { header: "Father's Name", expr: 's.father_name' },
            motherName: { header: "Mother's Name", expr: 's.mother_name' },
            dateOfBirth: { header: 'Date of Birth', expr: 's.date_of_birth' },
            admissionDate: { header: 'Admission Date', expr: 's.admission_date' },
            aadharNumber: { header: 'Aadhar Number', expr: 's.aadhar_number' },
            penNumber: { header: 'PEN Number', expr: 's.pen_number' },
            aaparId: { header: 'Aapar ID', expr: 's.aapar_id' },
            mobileNumber: { header: 'Mobile Number', expr: 's.mobile_number' },
            address: { header: 'Address', expr: 's.address' },
            grade: { header: 'Class', expr: 's.grade' },
            section: { header: 'Section', expr: 's.section' },
            yearlyFeeAmount: { header: 'Yearly Fee Amount', expr: 's.yearly_fee_amount', transform: v => v?.toString?.() ?? v },
            status: { header: 'Status', expr: 's.status' },
            leftDate: { header: 'Left Date', expr: 's.left_date' },
            leavingReason: { header: 'Leaving Reason', expr: 's.leaving_reason' },
            sessionName: { header: 'Session Name', expr: 'acs.name' },
            sessionGrade: { header: 'Session Class', expr: 'ss.grade' },
            sessionSection: { header: 'Session Section', expr: 'ss.section' },
            sessionStatus: { header: 'Session Status', expr: 'ss.status' },
            transportFee: { header: 'Transport Fee', expr: 'ss.transport_fee', transform: v => v?.toString?.() ?? v },
            isRTE: { header: 'RTE Status', expr: 'ss.is_rte', transform: v => v ? 'Yes' : 'No' }
        };

        const finalCols = (requested.length ? requested : Object.keys(allowedMap)).filter(c => allowedMap[c]);
        if (finalCols.length === 0) return res.status(400).json({ message: 'no valid columns requested' });

        const uniqueExprs: string[] = [];
        for (const c of finalCols) {
            const expr = allowedMap[c].expr;
            if (!uniqueExprs.includes(expr)) uniqueExprs.push(expr);
        }

        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        const currentSessionId = schoolRes.rows[0]?.current_session_id;

        const exprToAlias: Record<string, string> = {};
        const selectParts: string[] = [];

        uniqueExprs.forEach((expr, idx) => {
            const alias = `col_${idx}`;
            exprToAlias[expr] = alias;
            selectParts.push(`${expr} AS ${alias}`);
        });

        const safeQuery = `
        SELECT ${selectParts.join(', ')} 
        FROM students s
        LEFT JOIN student_sessions ss ON s.id = ss.student_id AND ss.session_id = $2
        LEFT JOIN academic_sessions acs ON ss.session_id = acs.id
        WHERE s.school_id = $1
        ORDER BY s.admission_number
      `;

        const { rows: safeRows } = await pool.query(safeQuery, [user.schoolId, currentSessionId]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Students');
        sheet.addRow(finalCols.map(c => allowedMap[c].header));

        for (const r of safeRows) {
            const rowValues = finalCols.map(c => {
                const def = allowedMap[c];
                const alias = exprToAlias[def.expr];
                const raw = (r as any)[alias];
                return def.transform ? def.transform(raw) : raw;
            });
            sheet.addRow(rowValues);
        }

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle' };
        finalCols.forEach((c, idx) => {
            let maxLen = allowedMap[c].header.length;
            for (let i = 2; i <= sheet.rowCount; i++) {
                const v = sheet.getRow(i).getCell(idx + 1).value;
                const len = v == null ? 0 : String(v).length;
                if (len > maxLen) maxLen = len;
            }
            sheet.getColumn(idx + 1).width = Math.min(60, Math.max(12, maxLen + 2));
        });
        const arrayBuffer = await workbook.xlsx.writeBuffer();
        const buf = Buffer.from(arrayBuffer);
        const filename = `students-${finalCols.length}-cols-${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buf);
    } catch (e: any) {
        console.error('students excel export error', e);
        res.status(500).json({ message: 'failed to export students xlsx', error: e?.message });
    }
});

router.get('/api/export/transactions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query(`
        SELECT f.transaction_id, f.amount, f.payment_date, f.payment_mode, f.remarks, s.admission_number, s.name
        FROM fee_transactions f JOIN students s ON s.id = f.student_id
        WHERE f.school_id = $1
        ORDER BY f.payment_date DESC, f.id DESC`, [user.schoolId]);
        const header = ['admissionNumber', 'studentName', 'transactionId', 'amount', 'paymentDate', 'paymentMode', 'remarks'];
        const csvRows = rows.map(r => [
            r.admission_number,
            escapeCsv(r.name),
            r.transaction_id,
            r.amount?.toString?.() ?? r.amount,
            r.payment_date,
            r.payment_mode,
            escapeCsv(r.remarks || '')
        ].join(','));
        const csv = [header.join(','), ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="transactions-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to export transactions' });
    }
});

router.get('/api/export/transactions/excel', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { start, end } = req.query as { start?: string; end?: string };
        const params: any[] = [user.schoolId];
        const where: string[] = ['f.school_id = $1'];
        if (start) { where.push(`f.payment_date >= $${params.length + 1}`); params.push(start); }
        if (end) { where.push(`f.payment_date <= $${params.length + 1}`); params.push(end); }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const q = await pool.query(`
        SELECT f.transaction_id, f.amount, f.payment_date, f.payment_mode, f.remarks,
               s.admission_number, s.name
        FROM fee_transactions f
        JOIN students s ON s.id = f.student_id
        ${whereSql}
        ORDER BY f.payment_date ASC, f.id ASC
      `, params);
        let total = 0;
        const rowsHtml = q.rows.map(r => {
            const amt = parseFloat(r.amount);
            total += isFinite(amt) ? amt : 0;
            return `<tr>
          <td>${r.admission_number}</td>
          <td>${escapeHtml(r.name)}</td>
          <td>${r.transaction_id}</td>
          <td>${amt.toFixed(2)}</td>
          <td>${r.payment_date}</td>
          <td>${r.payment_mode}</td>
          <td>${escapeHtml(r.remarks || '')}</td>
        </tr>`;
        }).join('');
        const summaryRow = `<tr style="font-weight:bold;background:#eef"><td></td><td>TOTAL</td><td></td><td>${total.toFixed(2)}</td><td></td><td></td><td></td></tr>`;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>Fee Transactions Export</title></head><body>
        <table border="1" cellspacing="0" cellpadding="4">
          <thead style="background:#ddd;font-weight:bold">
            <tr>
              <th>Admission Number</th><th>Student Name</th><th>Transaction ID</th><th>Amount (₹)</th><th>Payment Date</th><th>Payment Mode</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}${summaryRow}</tbody>
        </table>
      </body></html>`;
        const filename = `fee-transactions-${start || 'ALL'}-${end || 'ALL'}.xls`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(html);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ message: 'failed to export excel (html table)', error: e?.message });
    }
});

router.get('/api/export/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query(`
        SELECT g.subject, g.marks, g.term, s.admission_number
        FROM grades g JOIN students s ON s.id = g.student_id
        WHERE g.school_id = $1
        ORDER BY s.admission_number`, [user.schoolId]);
        const header = ['admissionNumber', 'subject', 'term', 'marks'];
        const csvRows = rows.map(r => [
            r.admission_number,
            escapeCsv(r.subject),
            escapeCsv(r.term),
            r.marks?.toString?.() ?? r.marks
        ].join(','));
        const csv = [header.join(','), ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="grades-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'failed to export grades' });
    }
});

export const reportRouter = router;
