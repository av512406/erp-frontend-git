import type { Express } from 'express';
import ExcelJS from 'exceljs';
import { createServer, type Server } from 'http';
import { db, pool, ensureTables, genId, genTransactionId } from './db';
import {
  users,
  students,
  teachers,
  feeTransactions,
  grades,
  subjects,
  classSubjects,
  documentTemplates,
  insertUserSchema,
  insertStudentSchema,
  insertTeacherSchema,
  insertFeeTransactionSchema,
  insertGradeSchema,
  insertSubjectSchema,
  insertClassSubjectSchema,
  insertDocumentTemplateSchema,
  schools
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import { hashPassword, comparePassword } from './lib/auth';

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SESSION_SECRET || "super_secret_school_erp_key";

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
      leavingReason: row.leaving_reason || '',
      category: row.category || 'GEN',
      gender: row.gender || ''
    };
  }

  function formatDateForClient(v: any) {
    if (v == null) return '';
    // If it's already a YYYY-MM-DD string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // If it's an ISO timestamp string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    // If it's a Date object
    if (v instanceof Date && !isNaN(v.getTime())) {
      const year = v.getFullYear();
      const month = String(v.getMonth() + 1).padStart(2, '0');
      const day = String(v.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Fallback: try to parse and format
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
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

  // Auth & User Management
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const user = result.rows[0];

      // Check password (supports both hashed and legacy plain text)
      let isValid = false;

      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isValid = await comparePassword(password, user.password);
      } else {
        // Legacy plain text check
        isValid = user.password === password;
      }

      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if school is active (for non-superadmin)
      if (user.role !== 'superadmin' && user.school_id) {
        const schoolRes = await pool.query('SELECT is_active FROM schools WHERE id = $1', [user.school_id]);
        if (schoolRes.rows.length > 0 && !schoolRes.rows[0].is_active) {
          return res.status(403).json({ message: 'Your school account has been deactivated. Please contact support.' });
        }
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          schoolId: user.school_id
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          schoolId: user.school_id
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/logout', (req, res) => {
    // Client-side logout (clear token)
    res.json({ message: 'Logged out' });
  });

  // Middleware to ensure authentication
  const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // Attach decoded user to request
      // Also attach to session for backward compatibility if needed, but better to migrate
      req.session = { user: decoded };
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: (req as any).user });
  });

  app.get('/api/school-config', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const { rows } = await pool.query('SELECT id, name, slug, address, phone, logo_url as "logoUrl", exam_pattern as "examPattern" FROM schools WHERE id = $1', [user.schoolId]);
      if (rows.length === 0) return res.status(404).json({ message: 'School not found' });

      const school = rows[0];
      // Parse examPattern if it's a string
      try {
        if (typeof school.examPattern === 'string') {
          school.examPattern = JSON.parse(school.examPattern);
        }
      } catch (e) {
        school.examPattern = ["Term 1", "Term 2", "Final"]; // Fallback
      }

      res.json(school);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch config' });
    }
  });

  // Super Admin: School Management
  app.get('/api/schools', async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
      const { rows } = await pool.query('SELECT * FROM schools ORDER BY created_at DESC');
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch schools' });
    }
  });

  app.post('/api/schools', async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
      const { name, slug, address, phone, logoUrl, examPattern } = req.body;
      // Basic validation
      if (!name || !slug) return res.status(400).json({ message: 'Name and Slug are required' });

      await client.query('BEGIN');

      const id = genId();
      const patternStr = examPattern ? JSON.stringify(examPattern) : '["Term 1", "Term 2", "Final"]';

      const q = await client.query(
        'INSERT INTO schools (id, name, slug, address, phone, logo_url, exam_pattern) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [id, name, slug, address, phone, logoUrl, patternStr]
      );

      // Create a default admin for this school
      const adminId = genId();
      const adminUsername = `admin@${slug}.com`;
      const adminPassword = `${slug}123`; // Default password

      await client.query(
        'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminId, adminUsername, adminPassword, 'admin', 'School Admin', id]
      );

      await client.query('COMMIT');

      res.status(201).json({ school: q.rows[0], admin: { username: adminUsername, password: adminPassword } });
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (e.code === '23505') return res.status(409).json({ message: 'School slug already exists' });
      console.error(e);
      res.status(500).json({ message: 'Failed to create school' });
    } finally {
      client.release();
    }
  });

  app.patch('/api/schools/:id/toggle-status', async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
      const { id } = req.params;
      const { isActive } = req.body;
      await pool.query('UPDATE schools SET is_active = $1 WHERE id = $2', [isActive, id]);
      res.json({ message: 'Status updated' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to update status' });
    }
  });

  app.post('/api/schools/:id/admin', async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
      const { id } = req.params;
      const { username, password } = req.body;

      if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

      // Check if username exists (globally unique)
      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        // If it exists, update it if it belongs to this school, else error
        const existingUser = await pool.query('SELECT school_id FROM users WHERE username = $1', [username]);
        if (existingUser.rows[0].school_id !== id) {
          return res.status(409).json({ message: 'Username already taken by another user' });
        }
        // Update existing admin
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [password, username]);
      } else {
        // Create new admin
        const adminId = genId();
        await pool.query(
          'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [adminId, username, password, 'admin', 'School Admin', id]
        );
      }

      res.json({ message: 'Admin credentials updated' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to update admin' });
    }
  });

  app.put('/api/schools/:id', async (req, res) => {
    const user = (req as any).user;
    // Allow superadmin OR the school admin themselves to update settings
    const isSuperAdmin = user.role === 'superadmin';
    const isSchoolAdmin = user.role === 'admin' && user.schoolId === req.params.id;

    if (!isSuperAdmin && !isSchoolAdmin) return res.status(403).json({ message: 'Forbidden' });

    try {
      const { id } = req.params;
      const { name, slug, address, phone, logoUrl, examPattern } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name) { updates.push(`name = $${idx++}`); values.push(name); }
      if (slug) { updates.push(`slug = $${idx++}`); values.push(slug); }
      if (address) { updates.push(`address = $${idx++}`); values.push(address); }
      if (phone) { updates.push(`phone = $${idx++}`); values.push(phone); }
      if (logoUrl !== undefined) { updates.push(`logo_url = $${idx++}`); values.push(logoUrl); }
      if (examPattern) {
        updates.push(`exam_pattern = $${idx++}`);
        values.push(JSON.stringify(examPattern));
      }

      updates.push(`updated_at = now()`);

      values.push(id);

      await pool.query(
        `UPDATE schools SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );

      res.json({ message: 'School updated' });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ message: 'Slug already exists' });
      console.error(e);
      res.status(500).json({ message: 'Failed to update school' });
    }
  });

  app.delete('/api/schools/:id', async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query('BEGIN');

      // Delete related data first (manual cascade)
      await client.query('DELETE FROM grades WHERE school_id = $1', [id]);
      await client.query('DELETE FROM fee_transactions WHERE school_id = $1', [id]);
      await client.query('DELETE FROM class_subjects WHERE school_id = $1', [id]);
      await client.query('DELETE FROM subjects WHERE school_id = $1', [id]);
      await client.query('DELETE FROM students WHERE school_id = $1', [id]);
      await client.query('DELETE FROM teachers WHERE school_id = $1', [id]); // If exists
      await client.query('DELETE FROM users WHERE school_id = $1', [id]);

      // Finally delete the school
      await client.query('DELETE FROM schools WHERE id = $1', [id]);

      await client.query('COMMIT');
      res.json({ message: 'School deleted' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ message: 'Failed to delete school' });
    } finally {
      client.release();
    }
  });



  app.get('/api/users', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const result = await pool.query('SELECT id, username, role, name, created_at FROM users WHERE school_id = $1 ORDER BY name', [user.schoolId]);
      res.json(result.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
      const data = insertUserSchema.parse(req.body);
      const role = data.role || 'teacher';
      const name = data.name || 'User';

      // 1. Enforce Limits per school
      const countRes = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND school_id = $2', [role, currentUser.schoolId]);
      const count = parseInt(countRes.rows[0].count);

      if (role === 'teacher' && count >= 50) { // Increased limit for real usage
        return res.status(400).json({ message: 'Maximum limit of teachers reached.' });
      }
      if (role === 'admin' && count >= 5) {
        return res.status(400).json({ message: 'Maximum limit of admins reached.' });
      }
      if (role === 'accountant' && count >= 5) {
        return res.status(400).json({ message: 'Maximum limit of accountants reached.' });
      }

      // 2. Format Username (username@schoolname.com)
      // Fetch school slug to generate domain
      const schoolRes = await pool.query('SELECT slug FROM schools WHERE id = $1', [currentUser.schoolId]);
      const schoolSlug = schoolRes.rows[0]?.slug || 'school';
      const domain = schoolSlug + '.com';

      // If the user didn't provide a full email, append the domain
      let finalUsername = data.username;
      if (!finalUsername.includes('@')) {
        finalUsername = `${finalUsername}@${domain}`;
      }

      const id = genId();

      const q = await pool.query(
        'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role, name',
        [id, finalUsername, data.password, role, name, currentUser.schoolId]
      );
      res.status(201).json(q.rows[0]);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'Username already exists' });
      console.error(e);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
      const id = req.params.id;
      const { password, role, name } = req.body;

      // Ensure user belongs to same school
      const check = await pool.query('SELECT id FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'User not found' });

      // Build dynamic update
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (password) {
        updates.push(`password = $${idx++}`);
        values.push(password);
      }
      if (role) {
        updates.push(`role = $${idx++}`);
        values.push(role);
      }
      if (name) {
        updates.push(`name = $${idx++}`);
        values.push(name);
      }

      if (updates.length === 0) return res.json({ message: 'No changes' });

      values.push(id);
      // Ensure update is scoped to school (redundant check but safe)
      values.push(currentUser.schoolId);

      const q = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} AND school_id = $${idx + 1} RETURNING id, username, role, name`,
        values
      );

      if (q.rowCount === 0) return res.status(404).json({ message: 'User not found' });
      res.json(q.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', requireAuth, async (req, res) => {
    const currentUser = (req as any).user;
    try {
      const id = req.params.id;

      // Check if user is an admin and if they are the last one for THIS school
      const userRes = await pool.query('SELECT role FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
      if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

      const role = userRes.rows[0].role;
      if (role === 'admin') {
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND school_id = $2', ['admin', currentUser.schoolId]);
        const count = parseInt(countRes.rows[0].count);
        if (count <= 1) {
          return res.status(403).json({ message: 'Cannot delete the only administrator. Create another admin first.' });
        }
      }

      await pool.query('DELETE FROM users WHERE id = $1 AND school_id = $2', [id, currentUser.schoolId]);
      res.json({ deleted: id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Students APIs
  app.get('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // return only active students for this school
    const { rows } = await pool.query("SELECT * FROM students WHERE (status <> 'left' OR status IS NULL) AND school_id = $1 ORDER BY admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
  });

  app.post('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const data = insertStudentSchema.parse(req.body);
      // check exists in THIS school
      const exists = await pool.query('SELECT 1 FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);
      if ((exists.rowCount ?? 0) > 0) return res.status(409).json({ message: 'admissionNumber exists' });
      const id = genId();
      const q = await pool.query(
        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, school_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16) RETURNING *`,
        [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber, data.penNumber, data.aaparId, data.mobileNumber, data.address, data.grade, data.section, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount || 0, user.schoolId]
      );
      res.status(201).json(mapStudent(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.put('/api/students/:admissionNumber', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const admissionNumber = req.params.admissionNumber;
      const data = insertStudentSchema.partial().parse(req.body);
      const existing = await pool.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [admissionNumber, user.schoolId]);
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

      values.push(admissionNumber);
      values.push(user.schoolId);

      const q = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE admission_number = $${sets.length + 1} AND school_id = $${sets.length + 2} RETURNING *`, values);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/students/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    await pool.query('DELETE FROM students WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
    res.json({ deleted: id });
  });

  // bulk import: supports strategy=skip|upsert
  app.post('/api/students/import', requireAuth, async (req, res) => {
    const user = (req as any).user;
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
          const exists = await client.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);
          if ((exists.rowCount ?? 0) > 0) {
            if (strategy === 'upsert') {
              // update
              await client.query(
                `UPDATE students SET name=$1, date_of_birth=$2, admission_date=$3, aadhar_number=$4, pen_number=$5, aapar_id=$6, mobile_number=$7, address=$8, grade=$9, section=$10, father_name=$11, mother_name=$12, yearly_fee_amount=$13, category=$14, gender=$15 WHERE admission_number=$16 AND school_id=$17`,
                [data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, data.admissionNumber, user.schoolId]
              );
              updated++;
            } else {
              skipped.push(data.admissionNumber);
            }
          } else {
            const id = genId();
            await client.query(
              `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, category, gender, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16, $17, $18)`,
              [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, user.schoolId]
            );
            added.push(data.admissionNumber);
          }
        } catch (e) {
          // validation error for this row -> skip
          console.error('Import validation error:', e);
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
  app.get('/api/students/left', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
  });
  // Alias with more professional terminology
  app.get('/api/students/withdrawn', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
  });

  // Mark a student as left (moved outside import route)
  app.put('/api/students/:admissionNumber/leave', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 AND school_id=$5 RETURNING *', ['left', dateToSet, reason || null, admissionNumber, user.schoolId]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark left' });
    }
  });

  app.post('/api/fees/:id/cancel', requireAuth, async (req, res) => {
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
  // Professional alias
  app.put('/api/students/:admissionNumber/withdraw', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const admissionNumber = req.params.admissionNumber;
      const { leftDate, reason } = req.body as { leftDate?: string; reason?: string };
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });
      const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
      const q = await pool.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 AND school_id=$5 RETURNING *', ['left', dateToSet, reason || null, admissionNumber, user.schoolId]);
      res.json(mapStudent(q.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to mark withdrawn' });
    }
  });
  // Restore a withdrawn student to active status
  app.put('/api/students/:admissionNumber/restore', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const admissionNumber = req.params.admissionNumber;
      const existing = await pool.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'student not found' });
      const current = existing.rows[0];
      if (current.status !== 'left') {
        // No-op restore; already active (avoid throwing 409 making UI look like error)
        return res.json(mapStudent(current));
      }
      const q = await pool.query('UPDATE students SET status=$1, left_date=NULL, leaving_reason=NULL WHERE admission_number=$2 AND school_id=$3 RETURNING *', ['active', admissionNumber, user.schoolId]);
      res.json(mapStudent(q.rows[0]));
    } catch (e: any) {
      console.error('restore error', e);
      res.status(500).json({ message: e?.message || 'failed to restore' });
    }
  });

  // Grades APIs
  app.get('/api/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query('SELECT * FROM grades WHERE school_id = $1', [user.schoolId]);
    res.json(rows.map(mapGrade));
  });

  // upsert grades in bulk
  app.post('/api/grades', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const incoming = req.body as any[];
    if (!Array.isArray(incoming)) return res.status(400).json({ message: 'grades array required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const keys: { studentId: string; subject: string; term: string }[] = [];
      for (const g of incoming) {
        try {
          const data = insertGradeSchema.parse(g);
          // Verify student belongs to school
          const studentCheck = await client.query('SELECT id FROM students WHERE id=$1 AND school_id=$2', [data.studentId, user.schoolId]);
          if ((studentCheck.rowCount ?? 0) === 0) continue; // Skip if student not found in school

          const exists = await client.query('SELECT id FROM grades WHERE student_id=$1 AND subject=$2 AND term=$3 AND school_id=$4', [data.studentId, data.subject, data.term, user.schoolId]);
          if ((exists.rowCount ?? 0) > 0) {
            await client.query('UPDATE grades SET marks=$1 WHERE id=$2', [data.marks, exists.rows[0].id]);
          } else {
            const id = genId();
            await client.query('INSERT INTO grades (id, student_id, subject, marks, term, school_id) VALUES ($1,$2,$3,$4,$5,$6)', [id, data.studentId, data.subject, data.marks, data.term, user.schoolId]);
          }
          keys.push({ studentId: data.studentId, subject: data.subject, term: data.term });
        } catch (e) {
          // skip invalid row
        }
      }
      await client.query('COMMIT');
      // fetch updated rows
      if (keys.length === 0) return res.json({ updated: 0, grades: [] });
      const conditions = keys.map((k, i) => `(student_id=$${i * 3 + 1} AND subject=$${i * 3 + 2} AND term=$${i * 3 + 3})`).join(' OR ');
      const params: any[] = [];
      keys.forEach(k => { params.push(k.studentId, k.subject, k.term); });
      // Ensure we only fetch grades for this school (though keys are derived from inputs we filtered, double safety)
      const refreshed = await pool.query(`SELECT * FROM grades WHERE (${conditions}) AND school_id = $${params.length + 1}`, [...params, user.schoolId]);
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
  app.get('/api/fees', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const { rows } = await pool.query(`
        SELECT f.id, f.student_id as "studentId", f.transaction_id as "transactionId", f.amount, f.payment_date as "paymentDate", f.payment_mode as "paymentMode", f.remarks,
               s.name as "studentName", f.created_at as "createdAt", f.updated_at as "updatedAt", f.receipt_serial as "receiptSerial", f.status, f.cancel_reason as "cancelReason"
        FROM fee_transactions f
        JOIN students s ON s.id = f.student_id
        WHERE f.school_id = $1
        ORDER BY f.payment_date DESC, f.id DESC
      `, [user.schoolId]);
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

  app.post('/api/fees', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const data = insertFeeTransactionSchema.parse(req.body);
      const amt = parseFloat((data as any).amount);
      if (!isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'amount must be greater than 0' });
      }
      // basic validation ensure student exists in school
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
          // Try per-school max+1
          const maxQ = await pool.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
          receiptSerial = Number(maxQ.rows[0].next);

          const q = await pool.query(
            `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks, receipt_serial, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null, receiptSerial, user.schoolId]
          );
          row = q.rows[0];
          break; // Success
        } catch (e: any) {
          if (e.code === '23505' && e.constraint === 'fee_transactions_school_id_receipt_serial_key') {
            // Race condition hit, retry
            retries--;
            lastError = e;
            continue;
          }
          throw e; // Other errors
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
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    }
  });

  // Assign a receipt serial to an existing transaction if missing (idempotent).
  app.post('/api/fees/:id/assign-serial', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
      const existing = await pool.query('SELECT receipt_serial FROM fee_transactions WHERE id=$1 AND school_id=$2', [id, user.schoolId]);
      if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'transaction not found' });
      const current = existing.rows[0].receipt_serial;
      if (current != null) return res.json({ receiptSerial: Number(current), assigned: false });

      // Generate next serial per school
      const maxQ = await pool.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
      const next = Number(maxQ.rows[0].next);

      const upd = await pool.query('UPDATE fee_transactions SET receipt_serial=$1 WHERE id=$2 RETURNING receipt_serial', [next, id]);
      return res.json({ receiptSerial: Number(upd.rows[0].receipt_serial), assigned: true });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ message: 'internal error' });
    }
  });

  // Bulk import fee transactions
  app.post('/api/fees/import', requireAuth, async (req, res) => {
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
          // ensure amount is string for schema/decimal
          const normalized = { ...row, amount: row.amount != null ? String(row.amount) : row.amount };
          const data = insertFeeTransactionSchema.parse(normalized);
          // verify student exists in school
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
              // Per-row sequence consumption (per school)
              const maxQ = await client.query('SELECT COALESCE(MAX(receipt_serial),0)+1 as next FROM fee_transactions WHERE school_id=$1', [user.schoolId]);
              const receiptSerial = Number(maxQ.rows[0].next);

              await client.query(
                `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks, receipt_serial, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [id, data.studentId, transactionId, data.amount, data.paymentDate, data.paymentMode, data.remarks || null, receiptSerial, user.schoolId]
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

  app.delete('/api/fees/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    await pool.query('DELETE FROM fee_transactions WHERE id=$1 AND school_id=$2', [id, user.schoolId]);
    res.json({ deleted: id });
  });

  // --- Subjects Management ---
  // Teachers APIs
  app.get('/api/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query('SELECT * FROM teachers WHERE school_id = $1 ORDER BY name', [user.schoolId]);
    res.json(rows);
  });

  app.post('/api/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const data = insertTeacherSchema.parse(req.body);
      const id = genId();
      const q = await pool.query(
        'INSERT INTO teachers (id, name, date_of_joining, salary, address, mobile_number, qualification, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [id, data.name, data.dateOfJoining, data.salary, data.address, data.mobileNumber, data.qualification, user.schoolId]
      );
      res.status(201).json(q.rows[0]);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'Failed to create teacher' });
    }
  });

  app.put('/api/teachers/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
      const data = insertTeacherSchema.partial().parse(req.body);
      // Construct dynamic update query
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data.name) { fields.push(`name=$${idx++}`); values.push(data.name); }
      if (data.dateOfJoining) { fields.push(`date_of_joining=$${idx++}`); values.push(data.dateOfJoining); }
      if (data.salary) { fields.push(`salary=$${idx++}`); values.push(data.salary); }
      if (data.address) { fields.push(`address=$${idx++}`); values.push(data.address); }
      if (data.mobileNumber) { fields.push(`mobile_number=$${idx++}`); values.push(data.mobileNumber); }
      if (data.qualification) { fields.push(`qualification=$${idx++}`); values.push(data.qualification); }

      if (fields.length === 0) return res.json({ message: 'No changes' });

      values.push(id);
      values.push(user.schoolId);
      const q = await pool.query(
        `UPDATE teachers SET ${fields.join(', ')} WHERE id=$${idx++} AND school_id=$${idx++} RETURNING *`,
        values
      );
      if (q.rowCount === 0) return res.status(404).json({ message: 'Teacher not found' });
      res.json(q.rows[0]);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'Failed to update teacher' });
    }
  });

  app.delete('/api/teachers/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    const q = await pool.query('DELETE FROM teachers WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
    if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Teacher not found' });
    res.json({ deleted: id });
  });

  app.get('/api/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query('SELECT * FROM subjects WHERE school_id = $1 ORDER BY name', [user.schoolId]);
    res.json(rows.map(mapSubject));
  });

  app.post('/api/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const data = insertSubjectSchema.parse(req.body);
      const exists = await pool.query('SELECT id FROM subjects WHERE name = $1 AND school_id = $2', [data.name, user.schoolId]);
      if ((exists.rowCount ?? 0) > 0) return res.status(409).json({ message: 'Subject already exists' });
      const id = genId();
      const q = await pool.query('INSERT INTO subjects (id, code, name, school_id) VALUES ($1, $2, $3, $4) RETURNING *', [id, data.code, data.name, user.schoolId]);
      res.status(201).json(mapSubject(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'Failed to create subject' });
    }
  });

  app.delete('/api/subjects/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    await pool.query('DELETE FROM subjects WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
    res.json({ deleted: id });
  });

  // Class-subject assignments
  app.get('/api/classes', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query(`
      SELECT DISTINCT grade FROM (
        SELECT grade FROM students WHERE grade IS NOT NULL AND school_id = $1
        UNION
        SELECT grade FROM class_subjects WHERE school_id = $1
      ) t
      WHERE grade IS NOT NULL AND grade <> ''
      ORDER BY grade
    `, [user.schoolId]);
    res.json(rows.map(r => r.grade));
  });

  app.get('/api/classes/:grade/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const { rows } = await pool.query(
      `SELECT s.*, cs.max_marks FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.grade=$1 AND cs.school_id=$2 ORDER BY s.name`,
      [grade, user.schoolId]
    );
    res.json(rows.map(mapSubject));
  });

  // Bulk sync: copy all subjects from a source class to all classes
  app.post('/api/classes/:grade/sync-all', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const sourceGrade = req.params.grade;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // fetch subject ids for source grade
      const src = await client.query(`SELECT subject_id FROM class_subjects WHERE grade=$1 AND school_id=$2`, [sourceGrade, user.schoolId]);
      const subjectIds: string[] = src.rows.map((r: any) => r.subject_id);
      if (subjectIds.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'no subjects assigned to source class' });
      }
      // fetch all grades
      const gradesRes = await client.query(`
        SELECT DISTINCT grade FROM (
          SELECT grade FROM students WHERE grade IS NOT NULL AND school_id=$1
          UNION
          SELECT grade FROM class_subjects WHERE school_id=$1
        ) t WHERE grade IS NOT NULL AND grade <> ''
      `, [user.schoolId]);
      const allGrades: string[] = gradesRes.rows.map((r: any) => r.grade);
      // insert for each grade
      let inserted = 0;
      for (const g of allGrades) {
        for (const sid of subjectIds) {
          const id = genId();
          try {
            await client.query(
              `INSERT INTO class_subjects (id, grade, subject_id, school_id) VALUES ($1,$2,$3,$4)
               ON CONFLICT (grade, subject_id) DO NOTHING`,
              [id, g, sid, user.schoolId]
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

  app.post('/api/classes/:grade/subjects', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const { subjectId, maxMarks } = req.body as { subjectId: string; maxMarks?: number };
    if (!subjectId) return res.status(400).json({ message: 'subjectId required' });
    const id = genId();
    try {
      // Verify subject belongs to school
      const subCheck = await pool.query('SELECT id FROM subjects WHERE id = $1 AND school_id = $2', [subjectId, user.schoolId]);
      if ((subCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Subject not found' });

      await pool.query('INSERT INTO class_subjects (id, grade, subject_id, max_marks, school_id) VALUES ($1,$2,$3,$4,$5)', [id, grade, subjectId, maxMarks ?? null, user.schoolId]);
      res.status(201).json({ id, grade, subjectId, maxMarks: maxMarks ?? null });
    } catch (e) {
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'already assigned' });
      res.status(500).json({ message: 'failed to assign' });
    }
  });

  // Update max marks for a class-subject assignment
  app.put('/api/classes/:grade/subjects/:subjectId', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    const { maxMarks } = req.body as { maxMarks?: number };
    try {
      const q = await pool.query('UPDATE class_subjects SET max_marks=$1 WHERE grade=$2 AND subject_id=$3 AND school_id=$4 RETURNING *', [maxMarks ?? null, grade, subjectId, user.schoolId]);
      if ((q.rowCount ?? 0) === 0) return res.status(404).json({ message: 'assignment not found' });
      res.json({ grade, subjectId, maxMarks: q.rows[0].max_marks });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to update' });
    }
  });

  app.delete('/api/classes/:grade/subjects/:subjectId', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const grade = req.params.grade;
    const subjectId = req.params.subjectId;
    await pool.query('DELETE FROM class_subjects WHERE grade=$1 AND subject_id=$2 AND school_id=$3', [grade, subjectId, user.schoolId]);
    res.json({ grade, subjectId, unassigned: true });
  });

  // --- Export Endpoints (CSV) ---
  app.get('/api/export/students/csv', requireAuth, async (req, res) => {
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

  // Real .xlsx export for students with selectable columns via ?cols=col1,col2 using exceljs
  app.get('/api/export/students/excel', requireAuth, async (req, res) => {
    const user = (req as any).user;
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
      const { rows } = await pool.query(`SELECT ${selectList} FROM students WHERE school_id = $1 ORDER BY admission_number`, [user.schoolId]);
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

  app.get('/api/export/transactions', requireAuth, async (req, res) => {
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

  // Excel export with optional date range filtering (inclusive)
  app.get('/api/export/transactions/excel', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // Fallback HTML-table based Excel (opens in Excel) to avoid external dependency issues
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
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to export excel (html table)', error: (e as any)?.message });
    }
  });

  app.get('/api/export/grades', requireAuth, async (req, res) => {
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

  app.get('/api/admin/config', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const { rows } = await pool.query('SELECT * FROM schools WHERE id=$1', [user.schoolId]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'School config not found' });
      }
      res.json(await mapConfig(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to load school config' });
    }
  });

  app.post('/api/admin/config', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });
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

      const q = await pool.query(
        `UPDATE schools SET name=$1, address=$2, phone=$3, logo_url=$4, updated_at=now() WHERE id=$5 RETURNING *`,
        [parsed.name, parsed.addressLine, normalizedPhone, parsed.logoUrl || null, user.schoolId]
      );

      if (q.rowCount === 0) return res.status(404).json({ message: 'School not found' });

      res.json(await mapConfig(q.rows[0]));
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'failed to save school config' });
    }
  });

  async function mapConfig(row: any) {
    // Fetch session name if current_session_id is present
    let sessionName = '2025-2026'; // Fallback
    if (row.current_session_id) {
      const res = await pool.query('SELECT name FROM academic_sessions WHERE id = $1', [row.current_session_id]);
      if (res.rows.length > 0) {
        sessionName = res.rows[0].name;
      }
    }

    return {
      name: row.name,
      addressLine: row.address, // mapped from address
      phone: row.phone,
      session: sessionName,
      logoUrl: row.logo_url || null,
      updatedAt: row.updated_at
    };
  }

  // Document Templates (Session-based)
  app.get("/api/templates/:type", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const schoolId = (req as any).user.schoolId;
      if (!schoolId) return res.status(400).json({ message: "No school associated with user" });

      const { type } = req.params;
      const [template] = await db
        .select()
        .from(documentTemplates)
        .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
        .limit(1);

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Document Templates (Admin/SuperAdmin management)
  app.get("/api/schools/:schoolId/templates/:type", async (req, res) => {
    try {
      const { schoolId, type } = req.params;
      const [template] = await db
        .select()
        .from(documentTemplates)
        .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
        .limit(1);

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/schools/:schoolId/templates", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { type, content, config } = req.body;

      // Check if template exists
      const [existing] = await db
        .select()
        .from(documentTemplates)
        .where(and(eq(documentTemplates.schoolId, schoolId), eq(documentTemplates.type, type)))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(documentTemplates)
          .set({ content, config, updatedAt: new Date().toISOString() })
          .where(eq(documentTemplates.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db
          .insert(documentTemplates)
          .values({
            schoolId,
            type,
            content,
            config
          })
          .returning();
        res.json(created);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to save template" });
    }
  });

  // --- Session Management Endpoints ---

  // 1. Create Session (Super Admin only)
  app.post('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const schema = z.object({
      name: z.string().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isActive: z.boolean().optional()
    });

    try {
      const data = schema.parse(req.body);
      const id = genId();
      const q = await pool.query(
        `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, data.name, data.startDate, data.endDate, data.isActive ?? false]
      );
      res.status(201).json(q.rows[0]);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'failed to create session' });
    }
  });

  // 2. List Sessions (Authenticated users)
  app.get('/api/sessions', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM academic_sessions ORDER BY start_date DESC');
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to list sessions' });
    }
  });

  // 3. Switch School Session (School Admin)
  app.post('/api/schools/session', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // Allow superadmin to switch for any school if schoolId provided, else use user's schoolId
    const targetSchoolId = (user.role === 'superadmin' && req.body.schoolId) ? req.body.schoolId : user.schoolId;

    if (!targetSchoolId) return res.status(400).json({ message: 'School ID required' });
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const schema = z.object({
      sessionId: z.string().uuid().or(z.string().min(1))
    });

    const client = await pool.connect();
    try {
      const { sessionId } = schema.parse(req.body);

      // Verify session exists
      const sessionCheck = await client.query('SELECT * FROM academic_sessions WHERE id = $1', [sessionId]);
      if (sessionCheck.rowCount === 0) return res.status(404).json({ message: 'Session not found' });

      await client.query('BEGIN');

      // 1. Update School's Current Session
      await client.query('UPDATE schools SET current_session_id = $1 WHERE id = $2', [sessionId, targetSchoolId]);

      // 2. Promote/Carry Over Active Students
      // Find all active students in the school
      const studentsQ = await client.query(
        `SELECT * FROM students WHERE school_id = $1 AND status = 'active'`,
        [targetSchoolId]
      );

      let promotedCount = 0;
      for (const student of studentsQ.rows) {
        // Check if already exists in target session
        const exists = await client.query(
          `SELECT 1 FROM student_sessions WHERE student_id = $1 AND session_id = $2`,
          [student.id, sessionId]
        );

        if ((exists.rowCount ?? 0) === 0) {
          // Create session record (Carry over same grade/section for now, user can update later)
          await client.query(
            `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [genId(), student.id, sessionId, student.grade, student.section, 'active', targetSchoolId]
          );
          promotedCount++;
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Session switched successfully', promotedStudents: promotedCount });

    } catch (e) {
      await client.query('ROLLBACK');
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'failed to switch session' });
    } finally {
      client.release();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
