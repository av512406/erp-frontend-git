import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { pool, ensureTables, genId, genTransactionId } from './db';
import { insertStudentSchema, insertGradeSchema, insertFeeTransactionSchema, insertSubjectSchema } from '../shared/schema';
import { ZodError } from 'zod';

export async function registerRoutes(app: Express): Promise<Server> {
  // ensure DB tables exist (helpful for local Docker)
  await ensureTables();

  // helper mappers
  function mapStudent(row: any) {
    return {
      id: row.id,
      admissionNumber: row.admission_number,
      name: row.name,
      dateOfBirth: row.date_of_birth,
      admissionDate: row.admission_date,
      aadharNumber: row.aadhar_number,
      penNumber: row.pen_number,
      aaparId: row.aapar_id,
      mobileNumber: row.mobile_number,
      address: row.address,
      grade: row.grade,
      section: row.section,
      fatherName: row.father_name,
      motherName: row.mother_name,
      yearlyFeeAmount: row.yearly_fee_amount?.toString?.() ?? row.yearly_fee_amount
    };
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
    };
  }

  // Students APIs
  app.get('/api/students', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM students ORDER BY admission_number');
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
        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
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
              `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
        } catch (e) {
          // skip invalid row
        }
      }
      await client.query('COMMIT');
  res.json({ updated: incoming.length });
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
  app.get('/api/classes/:grade/subjects', async (req, res) => {
    const grade = req.params.grade;
    const { rows } = await pool.query(
      `SELECT s.* FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.grade=$1 ORDER BY s.name`,
      [grade]
    );
    res.json(rows.map(mapSubject));
  });

  app.post('/api/classes/:grade/subjects', async (req, res) => {
    const grade = req.params.grade;
    const { subjectId } = req.body as { subjectId: string };
    if (!subjectId) return res.status(400).json({ message: 'subjectId required' });
    const id = genId();
    try {
      await pool.query('INSERT INTO class_subjects (id, grade, subject_id) VALUES ($1,$2,$3)', [id, grade, subjectId]);
      res.status(201).json({ id, grade, subjectId });
    } catch (e) {
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'already assigned' });
      res.status(500).json({ message: 'failed to assign' });
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

  const httpServer = createServer(app);
  return httpServer;
}
