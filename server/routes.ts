import type { Express } from 'express';
import ExcelJS from 'exceljs';
import { createServer, type Server } from 'http';
import { pool, ensureTables, genId, genTransactionId } from './db';
import { insertStudentSchema, insertGradeSchema, insertFeeTransactionSchema, insertSubjectSchema } from '../shared/schema';
import { ZodError, z } from 'zod';

export async function registerRoutes(app: Express): Promise<Server> {
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
    } catch {}
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

  app.post('/api/students', async (req, res) => {
    try {
      const data = insertStudentSchema.parse(req.body);
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

  app.put('/api/students/:admissionNumber', async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const data = insertStudentSchema.partial().parse(req.body);
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

  app.delete('/api/students/:id', async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
  res.json({ deleted: id });
  });

  // bulk import: supports strategy=skip|upsert
  app.post('/api/students/import', async (req, res) => {
    const { students: imported, strategy } = req.body as { students: any[]; strategy?: string };
    if (!Array.isArray(imported)) return res.status(400).json({ message: 'students array required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const added: any[] = [];
      const skipped: string[] = [];
      let updated = 0;
      for (const row of imported) {
        try {
          const data = insertStudentSchema.parse(row);
          const exists = await client.query('SELECT * FROM students WHERE admission_number = $1', [data.admissionNumber]);
            if ((exists.rowCount ?? 0) > 0) {
            if (strategy === 'upsert') {
              // update
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
        } catch (e) {
          // validation error for this row -> skip
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
  app.put('/api/students/:admissionNumber/leave', async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0,10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 RETURNING *', ['left', dateToSet, reason || null, admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark left' });
    }
  });
  // Professional alias
  app.put('/api/students/:admissionNumber/withdraw', async (req, res) => {
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1', [admissionNumber]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0,10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 RETURNING *', ['left', dateToSet, reason || null, admissionNumber]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark withdrawn' });
    }
  });
  // Restore a withdrawn student to active status
  app.put('/api/students/:admissionNumber/restore', async (req, res) => {
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
  app.post('/api/grades', async (req, res) => {
    const incoming = req.body as any[];
    if (!Array.isArray(incoming)) return res.status(400).json({ message: 'grades array required' });
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
        } catch (e) {
          // skip invalid row
        }
      }
      await client.query('COMMIT');
      // fetch updated rows
      if (keys.length === 0) return res.json({ updated: 0, grades: [] });
      const conditions = keys.map((k, i) => `(student_id=$${i*3+1} AND subject=$${i*3+2} AND term=$${i*3+3})`).join(' OR ');
      const params: any[] = [];
      keys.forEach(k => { params.push(k.studentId, k.subject, k.term); });
      const refreshed = await pool.query(`SELECT * FROM grades WHERE ${conditions}` , params);
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
    const { rows } = await pool.query(`
      SELECT f.id, f.student_id as "studentId", f.transaction_id as "transactionId", f.amount, f.payment_date as "paymentDate", f.payment_mode as "paymentMode", f.remarks,
             s.name as "studentName", f.created_at as "createdAt", f.updated_at as "updatedAt"
      FROM fee_transactions f
      JOIN students s ON s.id = f.student_id
      ORDER BY f.payment_date DESC, f.id DESC
    `);
    // adapt shape for frontend expectations (amount number, date field)
    const mapped = rows.map(r => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      amount: parseFloat(r.amount),
      date: r.paymentDate, // frontend uses 'date'
      transactionId: r.transactionId,
      paymentMode: r.paymentMode,
      remarks: r.remarks || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    res.json(mapped);
  });

  app.post('/api/fees', async (req, res) => {
    try {
      const data = insertFeeTransactionSchema.parse(req.body);
      const amt = parseFloat((data as any).amount);
      if (!isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'amount must be greater than 0' });
      }
      // basic validation ensure student exists
      const exists = await pool.query('SELECT id, name FROM students WHERE id=$1', [data.studentId]);
      if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });
      const id = genId();
      const transactionId = genTransactionId();
      const q = await pool.query(
        `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null]
      );
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
        updatedAt: row.updated_at
      });
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  // Bulk import fee transactions
  app.post('/api/fees/import', async (req, res) => {
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

  app.delete('/api/fees/:id', async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM fee_transactions WHERE id=$1', [id]);
    res.json({ deleted: id });
  });

  // --- Subjects Management ---
  app.get('/api/subjects', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM subjects ORDER BY name');
    res.json(rows.map(mapSubject));
  });

  app.post('/api/subjects', async (req, res) => {
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

  app.delete('/api/subjects/:id', async (req, res) => {
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
  app.post('/api/classes/:grade/sync-all', async (req, res) => {
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
          } catch {}
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

  app.post('/api/classes/:grade/subjects', async (req, res) => {
    const grade = req.params.grade;
    const { subjectId, maxMarks } = req.body as { subjectId: string; maxMarks?: number };
    if (!subjectId) return res.status(400).json({ message: 'subjectId required' });
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
  app.put('/api/classes/:grade/subjects/:subjectId', async (req, res) => {
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    const { maxMarks } = req.body as { maxMarks?: number };
    try {
      const q = await pool.query('UPDATE class_subjects SET max_marks=$1 WHERE grade=$2 AND subject_id=$3 RETURNING *', [maxMarks ?? null, grade, subjectId]);
      if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'assignment not found' });
      res.json({ grade, subjectId, maxMarks: q.rows[0].max_marks });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to update' });
    }
  });

  app.delete('/api/classes/:grade/subjects/:subjectId', async (req, res) => {
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    await pool.query('DELETE FROM class_subjects WHERE grade=$1 AND subject_id=$2', [grade, subjectId]);
    res.json({ grade, subjectId, unassigned: true });
  });

  // --- Export Endpoints (CSV) ---
  app.get('/api/export/students', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM students ORDER BY admission_number');
      const header = ['admissionNumber','name','fatherName','motherName','dateOfBirth','admissionDate','aadharNumber','penNumber','aaparId','mobileNumber','address','class','section','yearlyFeeAmount'];
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
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition',`attachment; filename="students-export-${new Date().toISOString().split('T')[0]}.csv"`);
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
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition',`attachment; filename="students-${finalCols.length}-cols-${new Date().toISOString().split('T')[0]}.xlsx"`);
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
      const header = ['admissionNumber','studentName','transactionId','amount','paymentDate','paymentMode','remarks'];
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
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition',`attachment; filename="transactions-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to export transactions' });
    }
  });

  // Excel export with optional date range filtering (inclusive)
  app.get('/api/export/transactions/excel', async (req, res) => {
    // Fallback HTML-table based Excel (opens in Excel) to avoid external dependency issues
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
      res.setHeader('Content-Type','application/vnd.ms-excel');
      res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
      res.send(html);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to export excel (html table)', error: (e as any)?.message });
    }
  });

  app.get('/api/export/grades', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT g.subject, g.marks, g.term, s.admission_number
        FROM grades g JOIN students s ON s.id = g.student_id
        ORDER BY s.admission_number`);
      const header = ['admissionNumber','subject','term','marks'];
      const csvRows = rows.map(r => [
        r.admission_number,
        escapeCsv(r.subject),
        escapeCsv(r.term),
        r.marks?.toString?.() ?? r.marks
      ].join(','));
      const csv = [header.join(','), ...csvRows].join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition',`attachment; filename="grades-export-${new Date().toISOString().split('T')[0]}.csv"`);
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
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
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
        await pool.query('INSERT INTO school_config (id, name, address_line, phone, session) VALUES ($1,$2,$3,$4,$5)', ['default','GLORIOUS PUBLIC SCHOOL','Jamoura (Sarkhadi), Distt. LALITPUR (U.P)','+91-0000-000000','2025-2026']);
        const recreated = await pool.query('SELECT * FROM school_config WHERE id=$1', ['default']);
        return res.json(mapConfig(recreated.rows[0]));
      }
      res.json(mapConfig(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to load school config' });
    }
  });

  app.post('/api/admin/config', async (req, res) => {
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
            return res.status(413).json({ message: 'logo exceeds 300KB limit', providedKB: Math.round(rawBytes/1024) });
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

  const httpServer = createServer(app);
  return httpServer;
}
