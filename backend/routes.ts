import type { Express } from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import { createServer, type Server } from 'http';
import { pool, ensureTables, genId, genTransactionId } from './db.js';
import { insertStudentSchema, insertGradeSchema, insertFeeTransactionSchema, insertSubjectSchema, createReceiptLedgerSchema, studentLeaveSchema, classSubjectAssignSchema, classSubjectUpdateSchema, feeTransactionImportSchema, gradeBulkArraySchema, studentImportSchema } from '@erp/shared';
import { handleRegister, handleLogin, authMiddleware, requireRole, currentUserFromReq } from './auth.js';
import { ZodError, z } from 'zod';
import { validateBody, sanitizeObjectStrings } from './validation.js';

export async function registerRoutes(app: Express): Promise<Server> {
  // CORS (configured via FRONTEND_ORIGIN; fallback to dev permissive)
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  app.use(cors({ origin, credentials: true }));
  // ensure DB tables exist (helpful for local Docker)
  await ensureTables();

  // helper mappers
  function mapStudent(row: any) {
    return {
      id: row.id,
      admissionNumber: row.admission_number,
      name: row.name,
      // normalize date fields to YYYY-MM-DD strings so frontend <input type="date"> can display them
      dateOfBirth: formatDateForClient(row.date_of_birth),
      admissionDate: formatDateForClient(row.admission_date),
      aadharNumber: row.aadhar_number,
      penNumber: row.pen_number,
      aaparId: row.aapar_id,
      mobileNumber: row.mobile_number,
      address: row.address,
      grade: row.grade,
      section: row.section,
      fatherName: row.father_name,
      motherName: row.mother_name,
      yearlyFeeAmount: row.yearly_fee_amount?.toString?.() ?? row.yearly_fee_amount,
      status: row.status || 'active',
      leftDate: formatDateForClient(row.left_date),
      leavingReason: row.leaving_reason || ''
    };
  }

  function formatDateForClient(v: any) {
    if (v == null) return '';
    // If it's already a YYYY-MM-DD string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // If it's an ISO timestamp string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    // If it's a Date object
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    // Fallback: try to parse and format
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { }
    return '';
  }

  function mapGrade(row: any) {
    return {
      id: row.id,
      studentId: row.student_id,
      subject: row.subject,
      marks: parseFloat(row.marks),
      term: row.term,
    };
  }

  function mapSubject(row: any) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      maxMarks: row.max_marks !== undefined ? (row.max_marks !== null ? parseFloat(row.max_marks) : null) : undefined,
    };
  }

  // Students APIs
  app.get('/api/students', async (_req, res) => {
    // return only active students
    const { rows } = await pool.query("SELECT * FROM students WHERE status <> 'left' OR status IS NULL ORDER BY admission_number");
    res.json(rows.map(mapStudent));
  });

  app.post('/api/students', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const data = insertStudentSchema.parse(sanitizeObjectStrings(req.body));
      // check exists
      const exists = await pool.query('SELECT 1 FROM students WHERE admission_number = $1', [data.admissionNumber]);
      if ((exists.rowCount ?? 0) > 0) return res.status(409).json({ message: 'admissionNumber exists' });
      const id = genId();
      const q = await pool.query(
        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active') RETURNING *`,
        [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount]
      );
      res.status(201).json(mapStudent(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.put('/api/students/:admissionNumber', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const data = insertStudentSchema.partial().parse(sanitizeObjectStrings(req.body));
      const existing = await pool.query('SELECT * FROM students WHERE admission_number = $1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      // build update set dynamically
      const keys = Object.keys(data);
      const values: any[] = [];
      const sets: string[] = [];
      keys.forEach((k, i) => {
        // map camelCase keys to snake_case DB columns
        const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^admission_number$/, 'admission_number');
        sets.push(`${col} = $${i + 1}`);
        values.push((data as any)[k]);
      });
      if (sets.length === 0) return res.json(mapStudent(existing.rows[0]));
      const q = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE admission_number = $${sets.length + 1} RETURNING *`, [...values, admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/students/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.json({ deleted: id });
  });

  // bulk import: supports strategy=skip|upsert
  app.post('/api/students/import', authMiddleware, requireRole(['admin']), async (req, res) => {
    let parsed; try { parsed = studentImportSchema.parse(req.body); } catch (e) { if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() }); return res.status(400).json({ message: 'invalid body' }); }
    const imported = parsed.students.map((s: any) => sanitizeObjectStrings(s)); const strategy = parsed.strategy;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const added: string[] = []; const skipped: string[] = []; let updated = 0;
      for (const row of imported) {
        try {
          const data = insertStudentSchema.parse(row);
          const exists = await client.query('SELECT 1 FROM students WHERE admission_number=$1', [data.admissionNumber]);
          if ((exists.rowCount ?? 0) > 0) {
            if (strategy === 'upsert') {
              await client.query(
                `UPDATE students SET name=$1, date_of_birth=$2, admission_date=$3, aadhar_number=$4, pen_number=$5, aapar_id=$6, mobile_number=$7, address=$8, grade=$9, section=$10, father_name=$11, mother_name=$12, yearly_fee_amount=$13 WHERE admission_number=$14`,
                [data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, data.admissionNumber]
              );
              updated++;
            } else {
              skipped.push(data.admissionNumber);
            }
          } else {
            const id = genId();
            await client.query(
              `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active')`,
              [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount]
            );
            added.push(data.admissionNumber);
          }
        } catch { /* skip invalid row */ }
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

  // List left students (moved outside import route)
  app.get('/api/students/left', async (_req, res) => {
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' ORDER BY left_date DESC NULLS LAST, admission_number");
    res.json(rows.map(mapStudent));
  });
  // Alias with more professional terminology
  app.get('/api/students/withdrawn', async (_req, res) => {
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' ORDER BY left_date DESC NULLS LAST, admission_number");
    res.json(rows.map(mapStudent));
  });

  // Mark a student as left (moved outside import route)
  app.put('/api/students/:admissionNumber/leave', authMiddleware, requireRole(['admin']), validateBody(studentLeaveSchema), async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = sanitizeObjectStrings((req as any).validated);
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 RETURNING *', ['left', dateToSet, reason || null, admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark left' });
    }
  });
  // Professional alias
  app.put('/api/students/:admissionNumber/withdraw', authMiddleware, requireRole(['admin']), validateBody(studentLeaveSchema), async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = sanitizeObjectStrings((req as any).validated);
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 RETURNING *', ['left', dateToSet, reason || null, admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark withdrawn' });
    }
  });
  // Restore a withdrawn student to active status
  app.put('/api/students/:admissionNumber/restore', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });
      const current = existing.rows[0];
      if (current.status !== 'left') {
        // No-op restore; already active (avoid throwing 409 making UI look like error)
        return res.json(mapStudent(current));
      }
      const q = await pool.query('UPDATE students SET status=$1, left_date=NULL, leaving_reason=NULL WHERE admission_number=$2 RETURNING *', ['active', admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e: any) {
      console.error('restore error', e);
      res.status(500).json({ message: e?.message || 'failed to restore' });
    }
  });

  // Grades APIs
  app.get('/api/grades', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM grades');
    res.json(rows.map(mapGrade));
  });

  // upsert grades in bulk
  app.post('/api/grades', authMiddleware, requireRole(['admin', 'teacher']), async (req, res) => {
    let incoming; try { incoming = gradeBulkArraySchema.parse(req.body); } catch (e) { if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() }); return res.status(400).json({ message: 'invalid body' }); }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const keys: { studentId: string; subject: string; term: string }[] = [];
      for (const g of incoming) {
        try {
          const data = insertGradeSchema.parse(g);
          const exists = await client.query('SELECT id FROM grades WHERE student_id=$1 AND subject=$2 AND term=$3', [data.studentId, data.subject, data.term]);
          if ((exists.rowCount ?? 0) > 0) {
            await client.query('UPDATE grades SET marks=$1 WHERE id=$2', [data.marks, exists.rows[0].id]);
          } else {
            const id = genId();
            await client.query('INSERT INTO grades (id, student_id, subject, marks, term) VALUES ($1,$2,$3,$4,$5)', [id, data.studentId, data.subject, data.marks, data.term]);
          }
          keys.push({ studentId: data.studentId, subject: data.subject, term: data.term });
        } catch { /* skip invalid row */ }
      }
      await client.query('COMMIT');
      // fetch updated rows
      if (keys.length === 0) return res.json({ updated: 0, grades: [] });
      const conditions = keys.map((k, i) => `(student_id=$${i * 3 + 1} AND subject=$${i * 3 + 2} AND term=$${i * 3 + 3})`).join(' OR ');
      const params: any[] = []; keys.forEach(k => { params.push(k.studentId, k.subject, k.term); });
      const refreshed = await pool.query(`SELECT * FROM grades WHERE ${conditions}`, params);
      res.json({ updated: keys.length, grades: refreshed.rows.map(mapGrade) });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ message: 'failed' });
    } finally {
      client.release();
    }
  });

  // Fee Transactions APIs
  app.get('/api/fees', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT f.id, f.student_id as "studentId", f.transaction_id as "transactionId", f.amount, f.payment_date as "paymentDate", f.payment_mode as "paymentMode", f.remarks,
               s.name as "studentName", f.created_at as "createdAt", f.updated_at as "updatedAt", f.receipt_serial as "receiptSerial"
        FROM fee_transactions f
        JOIN students s ON s.id = f.student_id
        ORDER BY f.payment_date DESC, f.id DESC
      `);
      const mapped = rows.map(r => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.studentName,
        amount: parseFloat(r.amount),
        date: r.paymentDate,
        transactionId: r.transactionId,
        paymentMode: r.paymentMode,
        remarks: r.remarks || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        receiptSerial: r.receiptSerial == null ? undefined : Number(r.receiptSerial)
      }));
      res.json(mapped);
    } catch (e: any) {
      // Fallback when receipt_serial column not yet migrated (42703 undefined column)
      if (e?.code === '42703') {
        const { rows } = await pool.query(`
          SELECT f.id, f.student_id as "studentId", f.transaction_id as "transactionId", f.amount, f.payment_date as "paymentDate", f.payment_mode as "paymentMode", f.remarks,
                 s.name as "studentName", f.created_at as "createdAt", f.updated_at as "updatedAt"
          FROM fee_transactions f
          JOIN students s ON s.id = f.student_id
          ORDER BY f.payment_date DESC, f.id DESC
        `);
        const mapped = rows.map(r => ({
          id: r.id,
          studentId: r.studentId,
          studentName: r.studentName,
          amount: parseFloat(r.amount),
          date: r.paymentDate,
          transactionId: r.transactionId,
          paymentMode: r.paymentMode,
          remarks: r.remarks || '',
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          receiptSerial: undefined
        }));
        res.json(mapped);
      } else {
        console.error(e);
        res.status(500).json({ message: 'failed to fetch fee transactions' });
      }
    }
  });

  app.post('/api/fees', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const data = insertFeeTransactionSchema.parse(sanitizeObjectStrings(req.body));
      const amt = parseFloat((data as any).amount);
      if (!isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'amount must be greater than 0' });
      }
      // basic validation ensure student exists
      const exists = await pool.query('SELECT id, name FROM students WHERE id=$1', [data.studentId]);
      if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });
      const id = genId();
      const transactionId = genTransactionId();
      // Rely on sequence-backed default; if column missing it's a deployment error.
      let q;
      try {
        q = await pool.query(
          `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null]
        );
      } catch (e: any) {
        if (e?.code === '42703') {
          return res.status(500).json({ message: 'receipt_serial column missing; ensureTables/migration not applied' });
        }
        throw e;
      }
      const row = q.rows[0];
      res.status(201).json({
        id: row.id,
        studentId: row.student_id,
        studentName: exists.rows[0].name,
        amount: parseFloat(row.amount),
        date: row.payment_date,
        transactionId: row.transaction_id,
        paymentMode: row.payment_mode,
        remarks: row.remarks || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        receiptSerial: row.receipt_serial == null ? undefined : Number(row.receipt_serial)
      });
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  // Create immutable receipt ledger entry (snapshot of breakdown items) for a fee transaction.
  app.post('/api/fees/:id/ledger', authMiddleware, requireRole(['admin', 'teacher']), async (req, res) => {
    const id = req.params.id;
    try {
      const parsed = createReceiptLedgerSchema.parse(req.body);
      // Fetch transaction
      const txQ = await pool.query('SELECT f.*, s.id as student_id FROM fee_transactions f JOIN students s ON s.id = f.student_id WHERE f.id=$1', [id]);
      if ((txQ.rowCount ?? 0) === 0) return res.status(404).json({ message: 'transaction not found' });
      const tx = txQ.rows[0];
      if (tx.receipt_serial == null) return res.status(409).json({ message: 'assign receipt serial before creating ledger' });
      // Check existing ledger
      const existing = await pool.query('SELECT id FROM receipt_ledger WHERE fee_transaction_id=$1', [id]);
      if ((existing.rowCount ?? 0) > 0) {
        const ledgerId = existing.rows[0].id;
        const ledgerFull = await pool.query('SELECT rl.*, s.name as student_name FROM receipt_ledger rl JOIN students s ON s.id=rl.student_id WHERE rl.id=$1', [ledgerId]);
        const itemsQ = await pool.query('SELECT label, amount, position FROM receipt_ledger_items WHERE ledger_id=$1 ORDER BY position', [ledgerId]);
        return res.json({ ledger: mapLedger(ledgerFull.rows[0]), items: itemsQ.rows.map(mapLedgerItem), created: false });
      }
      // Compute total from items and verify matches transaction amount (tolerate minor rounding)
      const totalFromItems = parsed.items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
      const txAmount = parseFloat(tx.amount);
      const delta = Math.abs(totalFromItems - txAmount);
      if (delta > 0.01) {
        return res.status(400).json({ message: 'items total does not match transaction amount', transactionAmount: txAmount, itemsTotal: totalFromItems });
      }
      const client = await pool.connect();
      let ledgerId: string;
      try {
        await client.query('BEGIN');
        ledgerId = genId();
        await client.query(
          `INSERT INTO receipt_ledger (id, fee_transaction_id, student_id, receipt_serial, payment_date, total_amount, items_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ledgerId, id, tx.student_id, tx.receipt_serial, tx.payment_date, txAmount, JSON.stringify(parsed.items)]
        );
        for (let i = 0; i < parsed.items.length; i++) {
          const it = parsed.items[i];
          await client.query(
            `INSERT INTO receipt_ledger_items (id, ledger_id, label, amount, position) VALUES ($1,$2,$3,$4,$5)`,
            [genId(), ledgerId, it.label, it.amount, i + 1]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      const ledgerFull = await pool.query('SELECT rl.*, s.name as student_name FROM receipt_ledger rl JOIN students s ON s.id=rl.student_id WHERE rl.id=$1', [ledgerId]);
      const itemsQ = await pool.query('SELECT label, amount, position FROM receipt_ledger_items WHERE ledger_id=$1 ORDER BY position', [ledgerId]);
      res.status(201).json({ ledger: mapLedger(ledgerFull.rows[0]), items: itemsQ.rows.map(mapLedgerItem), created: true });
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'failed to create ledger' });
    }
  });

  // List receipt ledgers (recent first)
  app.get('/api/receipts', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT rl.*, s.name as student_name
        FROM receipt_ledger rl
        JOIN students s ON s.id = rl.student_id
        ORDER BY rl.created_at DESC
        LIMIT 500`);
      const itemsQ = await pool.query('SELECT ledger_id, label, amount, position FROM receipt_ledger_items');
      const grouped: Record<string, any[]> = {};
      itemsQ.rows.forEach(r => { (grouped[r.ledger_id] ||= []).push(mapLedgerItem(r)); });
      res.json(rows.map(r => ({ ...mapLedger(r), items: (grouped[r.id] || []).sort((a, b) => a.position - b.position) })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to list receipts' });
    }
  });

  function mapLedger(row: any) {
    return {
      id: row.id,
      feeTransactionId: row.fee_transaction_id,
      studentId: row.student_id,
      studentName: row.student_name,
      receiptSerial: row.receipt_serial == null ? undefined : Number(row.receipt_serial),
      paymentDate: row.payment_date,
      totalAmount: parseFloat(row.total_amount),
      createdAt: row.created_at,
      itemsJson: row.items_json,
    };
  }
  function mapLedgerItem(row: any) {
    return {
      label: row.label,
      amount: parseFloat(row.amount),
      position: row.position
    };
  }

  // Assign a receipt serial to an existing transaction if missing (idempotent).
  app.post('/api/fees/:id/assign-serial', authMiddleware, requireRole(['admin']), async (req, res) => {
    const id = req.params.id;
    try {
      const existing = await pool.query('SELECT receipt_serial FROM fee_transactions WHERE id=$1', [id]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'transaction not found' });
      const current = existing.rows[0].receipt_serial;
      if (current != null) return res.json({ receiptSerial: Number(current), assigned: false });
      // Allocate strictly via sequence; error if missing.
      try {
        const seq = await pool.query("SELECT nextval('receipt_serial_seq') as serial");
        const next = Number(seq.rows[0].serial);
        const upd = await pool.query('UPDATE fee_transactions SET receipt_serial=$1 WHERE id=$2 RETURNING receipt_serial', [next, id]);
        return res.json({ receiptSerial: Number(upd.rows[0].receipt_serial), assigned: true });
      } catch (e: any) {
        if (e?.code === '42P01' || e?.code === '42703') {
          return res.status(500).json({ message: 'receipt_serial sequence or column missing; run ensureTables' });
        }
        throw e;
      }
    } catch (e: any) {
      if (e?.code === '42703') {
        return res.status(400).json({ message: 'receipt_serial column not found; run migration first' });
      }
      console.error(e);
      return res.status(500).json({ message: 'internal error' });
    }
  });

  // Bulk import fee transactions
  app.post('/api/fees/import', authMiddleware, requireRole(['admin']), async (req, res) => {
    let incoming: any[];
    try {
      incoming = feeTransactionImportSchema.parse(req.body);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      return res.status(400).json({ message: 'invalid body' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      const skipped: any[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const row = sanitizeObjectStrings(incoming[i]);
        try {
          // ensure amount is string for schema/decimal
          const normalized = { ...row, amount: row.amount != null ? String(row.amount) : row.amount };
          const data = insertFeeTransactionSchema.parse(normalized);
          // verify student exists
          const exists = await client.query('SELECT id FROM students WHERE id=$1', [data.studentId]);
          if ((exists.rowCount ?? 0) === 0) {
            skipped.push({ index: i, reason: 'student not found', row });
            continue;
          }
          const id = genId();
          const transactionId = genTransactionId();
          // rely on default-backed sequence; omit receipt_serial in insert list
          await client.query(
            `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null]
          );
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

  app.delete('/api/fees/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM fee_transactions WHERE id=$1', [id]);
    res.json({ deleted: id });
  });

  // --- Subjects Management ---
  app.get('/api/subjects', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM subjects ORDER BY name');
    res.json(rows.map(mapSubject));
  });

  app.post('/api/subjects', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const data = insertSubjectSchema.parse(req.body);
      const id = genId();
      const q = await pool.query('INSERT INTO subjects (id, code, name) VALUES ($1,$2,$3) RETURNING *', [id, data.code, data.name]);
      res.status(201).json(mapSubject(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'subject code exists' });
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/subjects/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM subjects WHERE id=$1', [id]);
    res.json({ deleted: id });
  });

  // Class-subject assignments
  // List all classes (grades) from students and class_subjects for UI selection
  app.get('/api/classes', async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT DISTINCT grade FROM (
        SELECT grade FROM students WHERE grade IS NOT NULL
        UNION
        SELECT grade FROM class_subjects
      ) t
      WHERE grade IS NOT NULL AND grade <> ''
      ORDER BY grade
    `);
    res.json(rows.map(r => r.grade));
  });

  app.get('/api/classes/:grade/subjects', async (req, res) => {
    const grade = req.params.grade;
    const { rows } = await pool.query(
      `SELECT s.*, cs.max_marks FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.grade=$1 ORDER BY s.name`,
      [grade]
    );
    res.json(rows.map(mapSubject));
  });

  // Bulk sync: copy all subjects from a source class to all classes
  app.post('/api/classes/:grade/sync-all', authMiddleware, requireRole(['admin']), async (req, res) => {
    const sourceGrade = req.params.grade;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // fetch subject ids for source grade
      const src = await client.query(`SELECT subject_id FROM class_subjects WHERE grade=$1`, [sourceGrade]);
      const subjectIds: string[] = src.rows.map((r: any) => r.subject_id);
      if (subjectIds.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'no subjects assigned to source class' });
      }
      // fetch all grades
      const gradesRes = await client.query(`
        SELECT DISTINCT grade FROM (
          SELECT grade FROM students WHERE grade IS NOT NULL
          UNION
          SELECT grade FROM class_subjects
        ) t WHERE grade IS NOT NULL AND grade <> ''
      `);
      const allGrades: string[] = gradesRes.rows.map((r: any) => r.grade);
      // insert for each grade
      let inserted = 0;
      for (const g of allGrades) {
        for (const sid of subjectIds) {
          const id = genId();
          try {
            await client.query(
              `INSERT INTO class_subjects (id, grade, subject_id) VALUES ($1,$2,$3)
               ON CONFLICT (grade, subject_id) DO NOTHING`,
              [id, g, sid]
            );
            inserted++;
          } catch { }
        }
      }
      await client.query('COMMIT');
      res.json({ syncedFrom: sourceGrade, grades: allGrades.length, subjects: subjectIds.length, inserted });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ message: 'sync failed' });
    } finally {
      client.release();
    }
  });

  app.post('/api/classes/:grade/subjects', authMiddleware, requireRole(['admin']), validateBody(classSubjectAssignSchema), async (req, res) => {
    const grade = req.params.grade;
    const { subjectId, maxMarks } = (req as any).validated as { subjectId: string; maxMarks?: number };
    const id = genId();
    try {
      await pool.query('INSERT INTO class_subjects (id, grade, subject_id, max_marks) VALUES ($1,$2,$3,$4)', [id, grade, subjectId, maxMarks ?? null]);
      res.status(201).json({ id, grade, subjectId, maxMarks: maxMarks ?? null });
    } catch (e) {
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'already assigned' });
      res.status(500).json({ message: 'failed to assign' });
    }
  });

  // Update max marks for a class-subject assignment
  app.put('/api/classes/:grade/subjects/:subjectId', authMiddleware, requireRole(['admin']), validateBody(classSubjectUpdateSchema), async (req, res) => {
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    const { maxMarks } = (req as any).validated as { maxMarks?: number | null };
    try {
      const q = await pool.query('UPDATE class_subjects SET max_marks=$1 WHERE grade=$2 AND subject_id=$3 RETURNING *', [maxMarks ?? null, grade, subjectId]);
      if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'assignment not found' });
      res.json({ grade, subjectId, maxMarks: q.rows[0].max_marks });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to update' });
    }
  });

  app.delete('/api/classes/:grade/subjects/:subjectId', authMiddleware, requireRole(['admin']), async (req, res) => {
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    await pool.query('DELETE FROM class_subjects WHERE grade=$1 AND subject_id=$2', [grade, subjectId]);
    res.json({ grade, subjectId, unassigned: true });
  });

  // --- Export Endpoints (CSV) ---
  app.get('/api/export/students', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM students ORDER BY admission_number');
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

  // Real .xlsx export for students with selectable columns via ?cols=col1,col2 using exceljs
  app.get('/api/export/students/excel', async (req, res) => {
    try {
      const rawCols = (req.query.cols as string | undefined) || '';
      const requested = rawCols.split(',').map(c => c.trim()).filter(Boolean);
      const allowedMap: Record<string, { header: string; expr: string; transform?: (v: any) => any }> = {
        admissionNumber: { header: 'Admission Number', expr: 'admission_number' },
        name: { header: 'Name', expr: 'name' },
        fatherName: { header: "Father's Name", expr: 'father_name' },
        motherName: { header: "Mother's Name", expr: 'mother_name' },
        dateOfBirth: { header: 'Date of Birth', expr: 'date_of_birth' },
        admissionDate: { header: 'Admission Date', expr: 'admission_date' },
        aadharNumber: { header: 'Aadhar Number', expr: 'aadhar_number' },
        penNumber: { header: 'PEN Number', expr: 'pen_number' },
        aaparId: { header: 'Aapar ID', expr: 'aapar_id' },
        mobileNumber: { header: 'Mobile Number', expr: 'mobile_number' },
        address: { header: 'Address', expr: 'address' },
        grade: { header: 'Class', expr: 'grade' },
        section: { header: 'Section', expr: 'section' },
        yearlyFeeAmount: { header: 'Yearly Fee Amount', expr: 'yearly_fee_amount', transform: v => v?.toString?.() ?? v },
        status: { header: 'Status', expr: 'status' },
        leftDate: { header: 'Left Date', expr: 'left_date' },
        leavingReason: { header: 'Leaving Reason', expr: 'leaving_reason' }
      };
      const finalCols = (requested.length ? requested : Object.keys(allowedMap)).filter(c => allowedMap[c]);
      if (finalCols.length === 0) return res.status(400).json({ message: 'no valid columns requested' });
      const uniqueExprs: string[] = [];
      for (const c of finalCols) {
        const expr = allowedMap[c].expr;
        if (!uniqueExprs.includes(expr)) uniqueExprs.push(expr);
      }
      const selectList = uniqueExprs.join(', ');
      const { rows } = await pool.query(`SELECT ${selectList} FROM students ORDER BY admission_number`);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Students');
      sheet.addRow(finalCols.map(c => allowedMap[c].header));
      for (const r of rows) {
        const rowValues = finalCols.map(c => {
          const def = allowedMap[c];
          const raw = (r as any)[def.expr];
          return def.transform ? def.transform(raw) : raw;
        });
        sheet.addRow(rowValues);
      }
      // Basic styling: header bold
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle' };
      // Auto width approximation
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
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="students-${finalCols.length}-cols-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buf);
    } catch (e) {
      console.error('students excel export error', e);
      res.status(500).json({ message: 'failed to export students xlsx', error: (e as any)?.message });
    }
  });

  app.get('/api/export/transactions', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT f.transaction_id, f.amount, f.payment_date, f.payment_mode, f.remarks, s.admission_number, s.name
        FROM fee_transactions f JOIN students s ON s.id = f.student_id
        ORDER BY f.payment_date DESC, f.id DESC`);
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

  // Excel export with optional date range filtering (inclusive)
  app.get('/api/export/transactions/excel', async (req, res) => {
    // New: native XLSX generation via ExcelJS for consistency with students export
    try {
      const { start, end } = req.query as { start?: string; end?: string };
      const params: any[] = [];
      const where: string[] = [];
      if (start) { where.push(`f.payment_date >= $${params.length + 1}`); params.push(start); }
      if (end) { where.push(`f.payment_date <= $${params.length + 1}`); params.push(end); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const q = await pool.query(`
        SELECT f.transaction_id, f.amount, f.payment_date, f.payment_mode, f.remarks,
               s.admission_number, s.name
        FROM fee_transactions f
        JOIN students s ON s.id = f.student_id
        ${whereSql}
        ORDER BY f.payment_date ASC, f.id ASC
      `, params);
      // Build workbook
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Transactions');
      const headers = ['Admission Number', 'Student Name', 'Transaction ID', 'Amount (₹)', 'Payment Date', 'Payment Mode', 'Remarks'];
      sheet.addRow(headers);
      let total = 0;
      for (const r of q.rows) {
        const amt = parseFloat(r.amount);
        if (isFinite(amt)) total += amt;
        sheet.addRow([
          r.admission_number,
          r.name,
          r.transaction_id,
          isFinite(amt) ? amt : r.amount,
          r.payment_date,
          r.payment_mode,
          r.remarks || ''
        ]);
      }
      // Summary row (bold)
      const summary = sheet.addRow(['', 'TOTAL', '', total, '', '', '']);
      summary.font = { bold: true };
      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle' };
      // Auto-size columns (bounded)
      for (let c = 1; c <= headers.length; c++) {
        let maxLen = headers[c - 1].length;
        for (let rIdx = 2; rIdx <= sheet.rowCount; rIdx++) {
          const v = sheet.getRow(rIdx).getCell(c).value;
          const len = v == null ? 0 : String(v).length;
          if (len > maxLen) maxLen = len;
        }
        sheet.getColumn(c).width = Math.min(50, Math.max(10, maxLen + 2));
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `fee-transactions-${start || 'ALL'}-${end || 'ALL'}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error('transactions excel export error', e);
      res.status(500).json({ message: 'failed to export transactions xlsx', error: (e as any)?.message });
    }
  });

  app.get('/api/export/grades', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT g.subject, g.marks, g.term, s.admission_number
        FROM grades g JOIN students s ON s.id = g.student_id
        ORDER BY s.admission_number`);
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

  // --- School Config Endpoints ---
  // Zod schema kept minimal; allow optional logo (URL or data URI)
  const schoolConfigSchema = z.object({
    name: z.string().min(1),
    addressLine: z.string().min(1),
    phone: z.string().transform(v => v.trim()).optional(),
    session: z.string().min(4),
    logoUrl: z.string().url().or(z.string().startsWith('data:')).nullable().optional()
  });

  app.get('/api/admin/config', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM school_config WHERE id=$1', ['default']);
      if (rows.length === 0) {
        // Should not happen (ensureTables inserts) but recreate if missing
        await pool.query('INSERT INTO school_config (id, name, address_line, phone, session) VALUES ($1,$2,$3,$4,$5)', ['default', 'GLORIOUS PUBLIC SCHOOL', 'Jamoura (Sarkhadi), Distt. LALITPUR (U.P)', '+91-0000-000000', '2025-2026']);
        const recreated = await pool.query('SELECT * FROM school_config WHERE id=$1', ['default']);
        return res.json(mapConfig(recreated.rows[0]));
      }
      res.json(mapConfig(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to load school config' });
    }
  });

  app.post('/api/admin/config', authMiddleware, requireRole(['admin']), async (req, res) => {
    try {
      const parsed = schoolConfigSchema.parse(req.body);
      const normalizedPhone = parsed.phone === '' ? null : parsed.phone;
      // Enforce max logo size (<=300KB raw) when data URI supplied
      if (parsed.logoUrl && /^data:/.test(parsed.logoUrl)) {
        const match = parsed.logoUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (match) {
          const b64 = match[1];
          // approximate decoded size
          const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
          const rawBytes = (b64.length * 3) / 4 - padding;
          const maxBytes = 300 * 1024; // 300KB
          if (rawBytes > maxBytes) {
            return res.status(413).json({ message: 'logo exceeds 300KB limit', providedKB: Math.round(rawBytes / 1024) });
          }
        } else {
          return res.status(400).json({ message: 'invalid base64 data URI for logo' });
        }
      }
      await pool.query(
        `INSERT INTO school_config (id, name, address_line, phone, session, logo_url, updated_at)
         VALUES ('default',$1,$2,$3,$4,$5, now())
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           address_line=EXCLUDED.address_line,
           phone=EXCLUDED.phone,
           session=EXCLUDED.session,
           logo_url=EXCLUDED.logo_url,
           updated_at=now()`,
        [parsed.name, parsed.addressLine, normalizedPhone, parsed.session, parsed.logoUrl || null]
      );
      const { rows } = await pool.query('SELECT * FROM school_config WHERE id=$1', ['default']);
      res.json(mapConfig(rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'failed to save school config' });
    }
  });

  function mapConfig(row: any) {
    return {
      name: row.name,
      addressLine: row.address_line,
      phone: row.phone,
      session: row.session,
      logoUrl: row.logo_url || null,
      updatedAt: row.updated_at
    };
  }

  // Register auth endpoints after other middleware/handlers initialization
  registerAuth(app);
  const httpServer = createServer(app);
  return httpServer;
}
// Auth endpoints registered after core routes to avoid interfering with existing middlewares
export function registerAuth(app: Express) {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const result = await handleRegister(req.body);
      res.status(result.status).json(result.payload);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: 'failed to register' });
    }
  });
  app.post('/api/auth/login', async (req, res) => {
    try {
      const result = await handleLogin(req.body);
      res.status(result.status).json(result.payload);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: 'failed to login' });
    }
  });
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const auth = currentUserFromReq(req);
    res.json({ user: auth ? { id: auth.sub, role: auth.role, email: auth.email } : null });
  });
}
