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
  schools,
  classes,
  attendance,
  insertClassSchema,
  insertAttendanceSchema
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import { hashPassword, comparePassword } from './lib/auth';

import jwt from 'jsonwebtoken';
import backupRouter from './backup_routes';

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
      rollNumber: row.roll_number, // Added roll number mapping
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
      previousYearDue: row.previous_year_due?.toString?.() ?? row.previous_year_due,
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
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      // Fallback for direct downloads (e.g. export)
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 3600 });
      req.user = decoded; // Attach decoded user to request
      // Also attach to session for backward compatibility if needed, but better to migrate
      req.session = { user: decoded };
      next();
    } catch (e: any) {
      console.error('JWT Verification Failed:', e.message); // Debugging 401
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // Middleware for Feature Checks
  const requireFeature = (featureName: string) => {
    return async (req: any, res: any, next: any) => {
      try {
        const user = req.user;
        if (user.role === 'superadmin') return next(); // Superadmin bypass? Maybe not, usually they want to see what user sees. But for management, yes. Let's allow bypass or strictly enforce school context.
        // Usually superadmin managing a school acts AS that school admin.

        const schoolId = user.schoolId;
        if (!schoolId) return res.status(403).json({ message: 'Feature restricted: No school context' });

        const schoolRes = await pool.query('SELECT features FROM schools WHERE id = $1', [schoolId]);
        if (schoolRes.rows.length === 0) return res.status(404).json({ message: 'School not found' });

        let features = schoolRes.rows[0].features;
        // Handle text or jsonb
        if (typeof features === 'string') {
          try { features = JSON.parse(features); } catch { features = {}; }
        } else if (!features) {
          features = {};
        }

        if (features[featureName]) {
          next();
        } else {
          res.status(403).json({ message: `Feature '${featureName}' is not enabled for your plan.` });
        }
      } catch (e) {
        console.error('Feature Check Failed:', e);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    };
  };

  app.get('/api/school-config', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const { rows } = await pool.query(`
        SELECT s.id, s.name, s.slug, s.address, s.phone, s.logo_url as "logoUrl", s.exam_pattern as "examPattern", s.features, ac.name as "session"
        FROM schools s
        LEFT JOIN academic_sessions ac ON s.current_session_id = ac.id
        WHERE s.id = $1
      `, [user.schoolId]);
      if (rows.length === 0) return res.status(404).json({ message: 'School not found' });

      const school = rows[0];
      // Parse JSON fields
      try {
        if (typeof school.examPattern === 'string') school.examPattern = JSON.parse(school.examPattern);
      } catch { school.examPattern = ["Term 1", "Term 2", "Final"]; }

      try {
        if (typeof school.features === 'string') school.features = JSON.parse(school.features);
      } catch { school.features = { attendance: false }; }

      // Default if null
      if (!school.features) school.features = { attendance: false };

      res.json(school);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch config' });
    }
  });

  // Super Admin: School Management
  app.get('/api/schools', requireAuth, async (req, res) => {
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

  app.post('/api/schools', requireAuth, async (req, res) => {
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

      const featuresStr = req.body.features ? JSON.stringify(req.body.features) : '{"attendance": false}';

      const q = await client.query(
        'INSERT INTO schools (id, name, slug, address, phone, logo_url, exam_pattern, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [id, name, slug, address, phone, logoUrl, patternStr, featuresStr]
      );

      // Create a default admin for this school
      const adminId = genId();
      const adminUsername = `admin@${slug}.com`;
      const adminPassword = `${slug}123`; // Default password

      await client.query(
        'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminId, adminUsername, adminPassword, 'admin', 'School Admin', id]
      );

      // 3. Seed Academic Sessions (Fix for Consistency)
      // Find "Global" sessions (distinct by name) from other schools to seed this new school
      // This ensures new schools start with the same sessions as existing ones.
      const existingSessions = await client.query('SELECT DISTINCT ON (name) name, start_date, end_date, is_active FROM academic_sessions');
      for (const s of existingSessions.rows) {
        await client.query(
          `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, $3, $4, $5, $6)`,
          [genId(), s.name, s.start_date, s.end_date, s.is_active, id]
        );
      }

      // 4. Set current_session_id to the active one (Self-Healing)
      const activeSessionRes = await client.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true LIMIT 1', [id]);
      if (activeSessionRes.rows.length > 0) {
        await client.query('UPDATE schools SET current_session_id = $1 WHERE id = $2', [activeSessionRes.rows[0].id, id]);
      }

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

  app.patch('/api/schools/:id/toggle-status', requireAuth, async (req, res) => {
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

  app.post('/api/schools/:id/admin', requireAuth, async (req, res) => {
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

  app.put('/api/schools/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // Allow superadmin OR the school admin themselves to update settings
    const isSuperAdmin = user.role === 'superadmin';
    const isSchoolAdmin = user.role === 'admin' && user.schoolId === req.params.id;

    if (!isSuperAdmin && !isSchoolAdmin) return res.status(403).json({ message: 'Forbidden' });

    try {
      const { id } = req.params;
      // Frontend sends addressLine, map it to address
      const { name, slug, address, phone, logoUrl, examPattern, session } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Logic for session update
        let newSessionId = undefined;
        if (session) {
          // Find or create session for THIS school
          const sessRes = await client.query('SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2', [session, id]);
          if (sessRes.rows.length > 0) {
            newSessionId = sessRes.rows[0].id;
          } else {
            // Create new session
            const insRes = await client.query(
              "INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, '2025-04-01', '2026-03-31', true, $3) RETURNING id",
              [genId(), session, id]
            );
            newSessionId = insRes.rows[0].id;
          }
        }

        // If examPattern is being updated, we need to check for renames
        if (examPattern && Array.isArray(examPattern)) {
          const currentRes = await client.query('SELECT exam_pattern FROM schools WHERE id = $1', [id]);
          if (currentRes.rows.length > 0) {
            let currentPattern = currentRes.rows[0].exam_pattern;
            if (typeof currentPattern === 'string') {
              try {
                currentPattern = JSON.parse(currentPattern);
              } catch (e) {
                currentPattern = [];
              }
            }
            if (Array.isArray(currentPattern)) {
              // Compare by index
              for (let i = 0; i < Math.min(currentPattern.length, examPattern.length); i++) {
                const oldTerm = currentPattern[i];
                const newTerm = examPattern[i];
                if (oldTerm !== newTerm) {
                  // Term renamed! Update grades
                  console.log(`Renaming term '${oldTerm}' to '${newTerm}' for school ${id}`);
                  await client.query(
                    'UPDATE grades SET term = $1 WHERE school_id = $2 AND term = $3',
                    [newTerm, id, oldTerm]
                  );
                }
              }
            }
          }
        }

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
        if (newSessionId) {
          updates.push(`current_session_id = $${idx++}`);
          values.push(newSessionId);
        }

        if (req.body.features) {
          updates.push(`features = $${idx++}`);
          values.push(JSON.stringify(req.body.features));
        }

        updates.push(`updated_at = now()`);

        values.push(id);

        await client.query(
          `UPDATE schools SET ${updates.join(', ')} WHERE id = $${idx}`,
          values
        );

        await client.query('COMMIT');
        res.json({ message: 'School updated' });
      } catch (e: any) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ message: 'Slug already exists' });
      console.error(e);
      res.status(500).json({ message: 'Failed to update school' });
    }
  });

  app.delete('/api/schools/:id', requireAuth, async (req, res) => {
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

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      console.log(`Creating user: ${finalUsername} (${role}) for school ${currentUser.schoolId}`);

      const q = await pool.query(
        'INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role, name',
        [id, finalUsername, hashedPassword, role, name, currentUser.schoolId]
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
    const { sessionId } = req.query;

    try {
      // Resolve Session ID
      let targetSessionId = sessionId as string;
      if (!targetSessionId) {
        // Default to school's current session
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        targetSessionId = schoolRes.rows[0]?.current_session_id;

        // Fallback: If no current session set, try to find the latest active session for the school
        if (!targetSessionId) {
          const sessionRes = await pool.query(
            'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
            [user.schoolId]
          );
          if (sessionRes.rows.length > 0) {
            targetSessionId = sessionRes.rows[0].id;
          }
        }
      }

      if (!targetSessionId) {
        return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } }); // No session defined, empty list
      }

      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const grade = req.query.grade as string;
      const section = req.query.section as string;
      const searchTerm = req.query.q as string;

      const params: any[] = [targetSessionId, user.schoolId];
      const conditions: string[] = [
        "ss.session_id = $1",
        "ss.school_id = $2",
        "(ss.status = 'active' OR ss.status = 'promoted')"
      ];

      if (grade && grade !== 'all') {
        conditions.push(`ss.grade = $${params.length + 1}`);
        params.push(grade);
      }

      if (section && section !== 'all') {
        conditions.push(`ss.section = $${params.length + 1}`);
        params.push(section);
      }

      // [RESTRICTION] Teacher can only see their own class
      if (user.role === 'teacher') {
        const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
        if (classRes.rows.length === 0) {
          return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } }); // No class assigned
        }
        const assigned = classRes.rows[0];
        // Enforce the filter (override any query params or append AND)
        // We'll append AND conditions which effectively restricts it.
        // If user requested a DIFFERENT grade, it will result in empty (grade=X AND grade=Y) which is correct security.
        conditions.push(`ss.grade = $${params.length + 1}`);
        params.push(assigned.grade);
        conditions.push(`ss.section = $${params.length + 1}`);
        params.push(assigned.section);
      }

      if (searchTerm) {
        const q = `%${searchTerm}%`;
        conditions.push(`(s.name ILIKE $${params.length + 1} OR s.admission_number ILIKE $${params.length + 1})`);
        params.push(q);
      }

      const whereClause = "WHERE " + conditions.join(" AND ");

      if (page && limit) {
        const offset = (page - 1) * limit;

        // Count Query
        const countQuery = `
          SELECT COUNT(*) as total
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
        `;
        const countRes = await pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].total);

        // Data Query
        const dataQuery = `
          SELECT 
            s.*,
            ss.grade as session_grade,
            ss.section as session_section,
            ss.status as session_status,
            ss.roll_number
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
          ORDER BY ss.grade, ss.section, s.name
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const queryParams = [...params, limit, offset];
        const { rows } = await pool.query(dataQuery, queryParams);

        const mapped = rows.map(row => ({
          ...mapStudent(row),
          grade: row.session_grade || row.grade,
          section: row.session_section || row.section,
          status: row.session_status || row.status,
          rollNumber: row.roll_number
        }));

        return res.json({
          data: mapped,
          meta: { total, page, limit }
        });
      } else {
        // No pagination
        const query = `
          SELECT 
            s.*,
            ss.grade as session_grade,
            ss.section as session_section,
            ss.status as session_status,
            ss.roll_number
          FROM students s
          INNER JOIN student_sessions ss ON s.id = ss.student_id
          ${whereClause}
          ORDER BY ss.grade, ss.section, s.name
        `;
        const { rows } = await pool.query(query, params);
        const mapped = rows.map(row => ({
          ...mapStudent(row),
          grade: row.session_grade || row.grade,
          section: row.session_section || row.section,
          status: row.session_status || row.status,
          rollNumber: row.roll_number
        }));
        res.json(mapped);
      }


    } catch (e) {
      console.error('Error fetching students:', e);
      res.status(500).json({ message: 'Failed to fetch students' });
    }
  });



  // [NEW] Get Candidates for Promotion (Students in Source Session NOT in Target Session)
  app.get('/api/sessions/:id/candidates', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const targetSessionId = req.params.id;
    const { sourceSessionId } = req.query;

    if (!sourceSessionId) return res.status(400).json({ message: 'sourceSessionId required' });

    try {
      // Find students in Source who are NOT in Target
      const query = `
        SELECT s.*, ss.grade as current_grade, ss.section as current_section 
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE ss.session_id = $1 
          AND ss.school_id = $2
          AND ss.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM student_sessions target 
            WHERE target.student_id = s.id AND target.session_id = $3
          )
        ORDER BY ss.grade, ss.section, s.name
      `;

      const { rows } = await pool.query(query, [sourceSessionId, user.schoolId, targetSessionId]);
      res.json(rows.map(r => ({
        ...mapStudent(r),
        grade: r.current_grade,
        section: r.current_section
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  });

  // [NEW] Promote/Import Students
  app.post('/api/students/promote', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { targetSessionId, students } = req.body;
    // students: { studentId: string, grade: string, section: string, rollNumber?: string }[]

    if (!targetSessionId || !Array.isArray(students)) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const inserted = [];
      for (const s of students) {
        const id = genId();
        await client.query(
          `INSERT INTO student_sessions (id, student_id, session_id, school_id, grade, section, roll_number, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            ON CONFLICT (student_id, session_id) DO UPDATE SET
              grade = EXCLUDED.grade,
              section = EXCLUDED.section,
              status = 'active'
           `,
          [id, s.studentId, targetSessionId, user.schoolId, s.grade, s.section, s.rollNumber || null]
        );
        inserted.push(s.studentId);
      }

      await client.query('COMMIT');
      res.json({ message: `Promoted/Imported ${inserted.length} students` });
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch absentee list' });
    }
  });

  app.post('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const client = await pool.connect();
    try {
      const data = insertStudentSchema.parse(req.body);

      // Get current session
      const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      const sessionId = schoolRes.rows[0]?.current_session_id;

      if (!sessionId) {
        return res.status(400).json({ message: 'Active academic session not set for school' });
      }

      await client.query('BEGIN');

      // check exists in THIS school
      const exists = await client.query('SELECT 1 FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);
      if ((exists.rowCount ?? 0) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'admissionNumber exists' });
      }

      const id = genId();
      const q = await client.query(
        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, school_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16) RETURNING *`,
        [id, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber, data.penNumber, data.aaparId, data.mobileNumber, data.address, data.grade, data.section, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount || 0, user.schoolId]
      );

      // Create session record
      await client.query(
        `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [genId(), id, sessionId, data.grade, data.section, 'active', user.schoolId]
      );

      await client.query('COMMIT');
      res.status(201).json(mapStudent(q.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'internal error' });
    } finally {
      client.release();
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
    const { students: imported, strategy, targetSessionId } = req.body as { students: any[]; strategy?: string; targetSessionId?: string };
    if (!Array.isArray(imported)) return res.status(400).json({ message: 'students array required' });
    const client = await pool.connect();
    try {
      // Get current school session (fallback)
      const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      const currentActiveSessionId = schoolRes.rows[0]?.current_session_id;

      // Fetch all academic sessions for lookup by name
      const allSessionsRes = await client.query('SELECT id, name FROM academic_sessions');
      const sessionMap = new Map<string, string>(); // Name -> ID
      allSessionsRes.rows.forEach(row => {
        sessionMap.set(row.name.trim().toLowerCase(), row.id);
      });

      // Determined fallback session: Target from frontend > Active School Session
      const fallbackSessionId = targetSessionId || currentActiveSessionId;

      if (!fallbackSessionId && imported.some(r => !r.session && !r['Session'] && !r['Session Name'])) {
        // If we have rows without session info AND no fallback, we might have an issue.
        // But we can proceed and just skip session linking for those specific rows (or error).
        // For now, we proceed.
      }

      await client.query('BEGIN');
      const added: any[] = [];
      const skipped: string[] = [];
      let updated = 0;
      // Track classes to avoid spamming DB in this transaction
      const existingClasses = new Set<string>();

      for (const row of imported) {
        try {
          await client.query('SAVEPOINT row_sp');
          const data = insertStudentSchema.parse(row);

          // Auto-create Class if distinct grade/section found
          if (data.grade && data.section) {
            const classKey = `${data.grade}-${data.section}`;
            if (!existingClasses.has(classKey)) {
              await client.query(
                `INSERT INTO classes (id, grade, section, school_id) 
                   VALUES ($1, $2, $3, $4) 
                   ON CONFLICT (school_id, grade, section) DO NOTHING`,
                [genId(), data.grade, data.section, user.schoolId]
              );
              existingClasses.add(classKey);
            }
          }

          // Determine session for this row
          const rowSessionName = (row.session || row['Session'] || row['Session Name'] || row.sessionName || '').toString().trim();
          let effectiveSessionId = fallbackSessionId;

          if (rowSessionName) {
            const fromMap = sessionMap.get(rowSessionName.toLowerCase());
            if (fromMap) {
              effectiveSessionId = fromMap;
            } else {
              // If session name in CSV doesn't exist, we could error, create it, or fall back.
              // User "If excel have, use that". If invalid, it's safer to probably NOT link than link to wrong one?
              // Or fall back. Let's log and fall back? No, user intent is specific.
              // Let's keep effectiveSessionId as is (fallback) or null?
              // If explicit session name is not found, better to treat it as "no session linked" for safety
              // OR use fallback. I will use fallback but maybe this is unexpected.
              // Actually, let's treat it as missing -> use fallback.
              console.warn(`Import: Session '${rowSessionName}' not found. Using fallback.`);
            }
          }

          let studentId = null;
          let isNew = false;

          const exists = await client.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);

          if ((exists.rowCount ?? 0) > 0) {
            studentId = exists.rows[0].id;
            if (strategy === 'upsert') {
              // update
              await client.query(
                `UPDATE students SET name=$1, date_of_birth=$2, admission_date=$3, aadhar_number=$4, pen_number=$5, aapar_id=$6, mobile_number=$7, address=$8, grade=$9, section=$10, father_name=$11, mother_name=$12, yearly_fee_amount=$13, category=$14, gender=$15, previous_year_due=$16 WHERE admission_number=$17 AND school_id=$18`,
                [data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', data.admissionNumber, user.schoolId]
              );
              updated++;
            } else {
              skipped.push(data.admissionNumber);
            }
          } else {
            studentId = genId();
            isNew = true;
            await client.query(
              `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, yearly_fee_amount, status, category, gender, previous_year_due, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', $16, $17, $18, $19)`,
              [studentId, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, data.yearlyFeeAmount, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', user.schoolId]
            );
            added.push(data.admissionNumber);
          }

          // Ensure session record exists
          // FIX: Even if strategy is 'skip' (meaning don't update profile), we MUST link to the new session if not present.
          if (studentId && effectiveSessionId) {
            // Check if session link exists
            const sessCheck = await client.query('SELECT 1 FROM student_sessions WHERE student_id = $1 AND session_id = $2', [studentId, effectiveSessionId]);
            if ((sessCheck.rowCount ?? 0) === 0) {
              await client.query(
                `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [genId(), studentId, effectiveSessionId, data.grade, data.section, 'active', user.schoolId]
              );
            } else if (strategy === 'upsert') {
              // Update grade/section in session too if upserting
              await client.query(
                `UPDATE student_sessions SET grade=$1, section=$2 WHERE student_id=$3 AND session_id=$4`,
                [data.grade, data.section, studentId, effectiveSessionId]
              );
            }
          }

          await client.query('RELEASE SAVEPOINT row_sp');
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
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

    // [RESTRICTION] Teacher can only see grades for their own class
    // Resolve Session ID
    let sessionId = req.query.sessionId as string;
    if (!sessionId) {
      const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      sessionId = schoolRes.rows[0]?.current_session_id;
    }
    // Fallback
    if (!sessionId) {
      const sessionRes = await pool.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
      if (sessionRes.rows.length > 0) sessionId = sessionRes.rows[0].id;
    }

    if (user.role === 'teacher') {
      const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
      if (classRes.rows.length === 0) return res.json([]);

      const { grade, section } = classRes.rows[0];

      // Join with student_sessions to filter by current class
      const query = `
        SELECT g.* 
        FROM grades g
        JOIN students s ON g.student_id = s.id
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE g.school_id = $1
          AND ss.grade = $2 
          AND ss.section = $3
          AND ss.status IN ('active', 'promoted')
      `;
      // Note: This filters based on student's CURRENT session/grade.
      // If we need historical, this might be tricky, but usually teacher manages current.
      // Assuming 'active' session context is sufficient or we need to join implicit current session.
      // Ideally we filter by session too? The code above doesn't enforce session on grades fetch explicitly but `student_sessions` has multiple rows.
      // We should probably pick the latest/active one. The previous code didn't filter at all.
      // Let's refine the join to ensure we don't get duplicates if student has multiple sessions.
      // We can use the school's current session or just use ANY active session.
      // Simple approach: Filter by ss.status = 'active'.

      const { rows } = await pool.query(query, [user.schoolId, grade, section]);
      return res.json(rows.map(mapGrade));
    }

    const { rows } = await pool.query('SELECT * FROM grades WHERE school_id = $1 AND (session_id = $2 OR session_id IS NULL)', [user.schoolId, sessionId]);
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

          // [RESTRICTION] Teacher can only upgrade students in their class
          if (user.role === 'teacher') {
            // Get teacher class (cached ideally, but here per request ok)
            // Optimization: Fetch once outside loop?
            // Since we are inside loop, let's just do it. But await inside loop is slow. 
            // Better to fetch outside.
            // But we can't easily change the whole structure in this chunk replace.
            // Let's do a subquery check or fetch strict.
            const allowed = await client.query(`
              SELECT 1 
              FROM classes c
              JOIN student_sessions ss ON c.grade = ss.grade AND c.section = ss.section
              WHERE c.class_teacher_id = $1 
                AND ss.student_id = $2
                AND ss.status = 'active'
            `, [user.id, data.studentId]);

            if ((allowed.rowCount ?? 0) === 0) {
              console.warn(`Teacher ${user.username} attempted to grade student ${data.studentId} not in their class.`);
              continue; // Skip
            }
          }

          const exists = await client.query('SELECT id FROM grades WHERE student_id=$1 AND subject=$2 AND term=$3 AND school_id=$4', [data.studentId, data.subject, data.term, user.schoolId]);
          const sessionRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
          let sessionId = sessionRes.rows[0]?.current_session_id;
          if (!sessionId) {
            const activeRes = await client.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
            sessionId = activeRes.rows[0]?.id;
          }

          if ((exists.rowCount ?? 0) > 0) {
            await client.query('UPDATE grades SET marks=$1 WHERE id=$2', [data.marks, exists.rows[0].id]);
          } else {
            const id = genId();
            await client.query('INSERT INTO grades (id, student_id, subject, marks, term, school_id, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, data.studentId, data.subject, data.marks, data.term, user.schoolId, sessionId]);
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
      let sessionId = req.query.sessionId as string;
      if (!sessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        sessionId = schoolRes.rows[0]?.current_session_id;
      }

      // If absolutely no session found (rare), fall back to checking all or active?
      // Better to return empty or try active fallback.
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
          AND (f.session_id = $2 OR f.session_id IS NULL) -- Include NULL for legacy compatibility? Or strictly session? Let's restrict to session but allow NULL if really old data? Safest is strict session if we want isolation. But to avoid "hiding" old data, maybe just session?
          -- For now, enforcing session_id = $2. If old data has NULL, it won't show anywhere, which is tricky.
          -- Let's assume we migrated or new data has it. I'll stick to strict session filter for correctness.
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

          const sessionRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
          const sessionId = sessionRes.rows[0]?.current_session_id;

          // If no session active, we should probably warn or block?
          // But to prevent breaking, let's allow NULL but log? Or perform fallback search?
          // Better self-healing: Find latest active.
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

              // Get current session
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
  app.get('/api/classes/grades', requireAuth, async (req, res) => {
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
        // Session specific
        sessionName: { header: 'Session Name', expr: 'acs.name' },
        sessionGrade: { header: 'Session Class', expr: 'ss.grade' },
        sessionSection: { header: 'Session Section', expr: 'ss.section' },
        sessionStatus: { header: 'Session Status', expr: 'ss.status' }
      };

      const finalCols = (requested.length ? requested : Object.keys(allowedMap)).filter(c => allowedMap[c]);
      if (finalCols.length === 0) return res.status(400).json({ message: 'no valid columns requested' });

      const uniqueExprs: string[] = [];
      for (const c of finalCols) {
        const expr = allowedMap[c].expr;
        if (!uniqueExprs.includes(expr)) uniqueExprs.push(expr);
      }
      const selectList = uniqueExprs.join(', ');

      // Get current school session
      const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      const currentSessionId = schoolRes.rows[0]?.current_session_id;

      // Ensure we have a session to join against
      if (!currentSessionId) {
        // If no session, these columns will be null, but we still export 'students'
        // We can just join with a dummy condition or handle gracefully.
        // For now, let's use a LEFT JOIN that might return nulls if no session matches
      }

      // Re-implementing correctly with aliases to avoid collision
      // Re-map uniqueExprs to "expr as alias"
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
      const filename = `students-${finalCols.length}-cols-${new Date().toISOString().split('T')[0]}.xlsx`;

      res.attachment(filename);
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
  // Zod schema updated to allow sessionId
  const schoolConfigSchema = z.object({
    name: z.string().min(1),
    addressLine: z.string().min(1),
    phone: z.string().transform(v => v.trim()).optional(),
    session: z.string().optional(), // kept for compatibility, ignored for update
    sessionId: z.string().uuid().optional(), // NEW: ID to update active session
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

      // If sessionId provided, verify it exists (scoped to school or global? sessions are global but linked to school now??
      // Wait, sessions are filtered by school_id in GET /api/sessions. So we should verify it belongs to this school.
      // Actually, POST /api/sessions creates for ALL schools. So every school has its own copy of "2025-2026".
      // So we must verify the session belongs to THIS school.
      let targetSessionId = null;
      if (parsed.sessionId) {
        const sCheck = await pool.query('SELECT id FROM academic_sessions WHERE id=$1 AND school_id=$2', [parsed.sessionId, user.schoolId]);
        if (sCheck.rowCount === 0) return res.status(400).json({ message: 'Invalid session ID for this school' });
        targetSessionId = parsed.sessionId;
      }

      // Update query construction
      // We conditionally update current_session_id only if provided
      const updateFields = [parsed.name, parsed.addressLine, normalizedPhone, parsed.logoUrl || null];
      let updateSql = `UPDATE schools SET name=$1, address=$2, phone=$3, logo_url=$4, updated_at=now()`;

      if (targetSessionId) {
        updateSql = `UPDATE schools SET name=$1, address=$2, phone=$3, logo_url=$4, current_session_id=$5, updated_at=now()`;
        updateFields.push(targetSessionId);
      }

      // Append WHERE clause
      updateSql += ` WHERE id=$${updateFields.length + 1} RETURNING *`;
      updateFields.push(user.schoolId);

      const q = await pool.query(updateSql, updateFields);

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
      sessionId: row.current_session_id || null, // NEW: return ID for dropdown
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

  // 1. Create Session (School Admin only)
  app.post('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Only School Admin can manage sessions' });

    const schema = z.object({
      name: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2025-26)"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isActive: z.boolean().optional()
    });

    const client = await pool.connect();
    try {
      const data = schema.parse(req.body);

      // Check uniqueness for THIS school
      const exists = await client.query(
        'SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2',
        [data.name, user.schoolId]
      );

      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({ message: 'Session with this name already exists' });
      }

      const id = genId();
      // Transaction to handle exclusive active status
      await client.query('BEGIN');
      try {
        const insertRes = await client.query(
          `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [id, data.name, data.startDate, data.endDate, data.isActive ?? false, user.schoolId]
        );

        if (data.isActive) {
          // Deactivate all others
          await client.query('UPDATE academic_sessions SET is_active = false WHERE school_id = $1 AND id != $2', [user.schoolId, id]);
          // Update school's current_session_id
          await client.query('UPDATE schools SET current_session_id = $1 WHERE id = $2', [id, user.schoolId]);
        }

        await client.query('COMMIT');
        res.status(201).json({ ...data, id, schoolId: user.schoolId });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      if ((e as any)?.code === '23505') return res.status(409).json({ message: 'Session already exists' });
      console.error(e);
      res.status(500).json({ message: 'failed to create session' });
    } finally {
      client.release();
    }
  });

  app.put('/api/sessions/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Only School Admin can manage sessions' });

    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const schema = z.object({
      name: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2025-26)").optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      isActive: z.boolean().optional()
    });

    const client = await pool.connect();
    try {
      const data = schema.parse({ name, startDate, endDate, isActive });
      await client.query('BEGIN');

      // Verify ownership
      const check = await client.query('SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
      if (check.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Session not found' });
      }

      // If name change, check uniqueness
      if (data.name) {
        const dup = await client.query('SELECT id FROM academic_sessions WHERE name = $1 AND school_id = $2 AND id <> $3', [data.name, user.schoolId, id]);
        if (dup.rowCount! > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ message: 'Session name already exists' });
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data.name) { updates.push(`name = $${idx++}`); values.push(data.name); }
      if (data.startDate) { updates.push(`start_date = $${idx++}`); values.push(data.startDate); }
      if (data.endDate) { updates.push(`end_date = $${idx++}`); values.push(data.endDate); }
      if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.isActive); }

      if (updates.length > 0) {
        updates.push(`updated_at = now()`); // Assuming updated_at exists or just no-op if not? schema didn't show it but good practice. schema says ?? wait schema not shown fully. Assuming fine.
        // wait schema in previous view didn't distinctively show updated_at for academic_sessions. 
        // Let's check schema lines 178.
        // It did not show updated_at. I should remove it to be safe.
        // Re-reading schema lines 178-187... no updated_at.

        values.push(id);
        await client.query(
          `UPDATE academic_sessions SET ${updates.filter(u => !u.includes('updated_at')).join(', ')} WHERE id = $${idx}`,
          values
        );
      }

      const finalRow = await client.query('SELECT * FROM academic_sessions WHERE id = $1', [id]);
      await client.query('COMMIT');
      res.json(finalRow.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'Failed to update session' });
    } finally {
      client.release();
    }
  });

  app.delete('/api/sessions/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { id } = req.params;
    try {
      // Basic check if any data depends on it...
      // student_sessions, fees...
      // For now, let DB constraints fail if dependent data exists?
      // Or we can just try delete.
      const q = await pool.query('DELETE FROM academic_sessions WHERE id = $1 AND school_id = $2', [id, user.schoolId]);
      if (q.rowCount === 0) return res.status(404).json({ message: 'Session not found' });
      res.json({ message: 'Session deleted' });
    } catch (e: any) {
      if (e.code === '23503') return res.status(400).json({ message: 'Cannot delete session with linked data' });
      console.error(e);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });

  // 2. List Sessions (Authenticated users - School Scoped)
  app.get('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      // Just return school-specific sessions. 
      // If superadmin calls this, they likely need a school context (via query param?) or we return empty?
      // Since SuperAdmin dashboard had tabs for this, we are removing that tab.
      // So this is strictly for School Admin / Teachers within a school.
      // If user.schoolId is missing (SuperAdmin global view), we return empty or error.
      if (!user.schoolId) return res.json([]);

      const query = 'SELECT * FROM academic_sessions WHERE school_id = $1 ORDER BY start_date DESC';
      const { rows } = await pool.query(query, [user.schoolId]);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'failed to list sessions' });
    }
  });

  // 3. Switch School Session (School Admin) - DEPRECATED / REMOVED LOGIC
  // User requested removal of auto-promotion. This endpoint now just returns success or updates purely the session ID if needed,
  // but since we moved logic to Config update, we'll just make this a no-op safety or minimal update.
  app.post('/api/schools/session', requireAuth, async (req, res) => {
    // Logic moved to POST /api/admin/config. 
    // Returning success to prevent errors if UI still calls it before reload.
    res.json({ message: 'Session switch handled via settings', promotedStudents: 0 });
  });

  // --- Class Management APIs ---

  app.get('/api/classes', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      // Fetch classes with teacher name
      const query = `
        SELECT c.*, u.name as teacher_name 
        FROM classes c
        LEFT JOIN users u ON c.class_teacher_id = u.id
        WHERE c.school_id = $1
        ORDER BY c.grade, c.section
      `;
      const { rows } = await pool.query(query, [user.schoolId]);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch classes' });
    }
  });

  app.post('/api/classes', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      const data = insertClassSchema.parse(req.body);

      // Check unique (grade, section)
      const exists = await pool.query(
        'SELECT 1 FROM classes WHERE grade = $1 AND section = $2 AND school_id = $3',
        [data.grade, data.section, user.schoolId]
      );
      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({ message: 'Class already exists' });
      }

      const id = genId();
      await pool.query(
        'INSERT INTO classes (id, grade, section, class_teacher_id, school_id) VALUES ($1, $2, $3, $4, $5)',
        [id, data.grade, data.section, data.classTeacherId || null, user.schoolId]
      );

      res.status(201).json({ message: 'Class created' });
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.format() });
      console.error(e);
      res.status(500).json({ message: 'Failed to create class' });
    }
  });

  app.delete('/api/classes/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      await pool.query('DELETE FROM classes WHERE id = $1 AND school_id = $2', [req.params.id, user.schoolId]);
      res.json({ message: 'Class deleted' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to delete class' });
    }
  });

  // Assign Teacher to Class
  app.put('/api/classes/:id/assign-teacher', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { teacherId } = req.body;
    try {
      await pool.query(
        'UPDATE classes SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3',
        [teacherId, req.params.id, user.schoolId]
      );
      res.json({ message: 'Teacher assigned' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to assign teacher' });
    }
  });

  // --- Teacher Dashboard & Attendance APIs ---

  app.get('/api/teacher/my-class', requireAuth, async (req, res) => {
    const user = (req as any).user;
    // Removed strict role check to allow testing/admin impersonation if needed, or keep it?
    // User said "admin will create teacher...", implying role is teacher.
    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      // Find assigned class directly via user.id (which is now linked in classes table)
      const classRes = await pool.query('SELECT * FROM classes WHERE class_teacher_id = $1', [user.id]);

      const teacherInfo = { id: user.id, name: user.name };

      if (classRes.rows.length === 0) return res.json({ teacher: teacherInfo, class: null });

      res.json({ teacher: teacherInfo, class: classRes.rows[0] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Error fetching teacher class' });
    }
  });

  // [NEW] Get Students for Class Teacher (with Fee Details - HIDDEN for Privacy)
  app.get('/api/teacher/my-class/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'teacher' && user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    try {
      // 1. Get Class Assigned
      const classRes = await pool.query('SELECT * FROM classes WHERE class_teacher_id = $1', [user.id]);
      if (classRes.rows.length === 0) return res.status(404).json({ message: 'No class assigned' });
      const cls = classRes.rows[0];

      // 2. Determine Session
      let { sessionId } = req.query;
      if (!sessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        sessionId = schoolRes.rows[0]?.current_session_id;
      }
      if (!sessionId) return res.status(400).json({ message: 'No active session' });

      // 3. Fetch Students in that class for current session
      // REMOVED FEE SUMMARY JOIN for privacy
      const query = `
        SELECT 
          s.id, s.name, s.admission_number, ss.roll_number, s.mobile_number
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE ss.grade = $1 AND ss.section = $2 
          AND ss.session_id = $3 AND ss.school_id = $4
          AND ss.status = 'active'
        ORDER BY s.name
      `;

      const { rows } = await pool.query(query, [cls.grade, cls.section, sessionId, user.schoolId]);

      const mapped = rows.map(r => ({
        id: r.id,
        name: r.name,
        admissionNumber: r.admission_number,
        rollNumber: r.roll_number,
        mobileNumber: r.mobile_number,
        // Hide financials
        yearlyFee: 0,
        totalPaid: 0,
        balance: 0
      }));

      res.json(mapped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch class students' });
    }
  });

  // [NEW] Attendance Summary for Class Teacher
  app.get('/api/teacher/my-class/attendance-summary', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'teacher' && user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    try {
      const { startDate, endDate } = req.query;

      // 1. Get Class & Session
      const classRes = await pool.query('SELECT grade, section FROM classes WHERE class_teacher_id = $1', [user.id]);
      if (classRes.rows.length === 0) return res.status(404).json({ message: 'No class assigned' });
      const { grade, section } = classRes.rows[0];

      // Determine session
      let targetSessionId = req.query.sessionId;
      if (!targetSessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        targetSessionId = schoolRes.rows[0]?.current_session_id;
      }

      const sessionId = targetSessionId;

      let dateFilter = "";
      const queryParams: any[] = [sessionId, user.schoolId, grade, section];

      if (startDate && endDate) {
        dateFilter = ` AND date >= $${queryParams.length + 1} AND date <= $${queryParams.length + 2}`;
        queryParams.push(startDate);
        queryParams.push(endDate);
      }

      // 2. Aggregate Attendance Logic
      const query = `
        WITH stats AS (
          SELECT 
            student_id,
            COUNT(*) FILTER (WHERE status = 'Present') as present_count,
            COUNT(*) FILTER (WHERE status = 'Absent') as absent_count,
            COUNT(*) FILTER (WHERE status = 'Leave') as leave_count,
            COUNT(*) FILTER (WHERE status = 'Late') as late_count,
            COUNT(*) as total_marked
          FROM attendance
          WHERE session_id = $1 AND school_id = $2 ${dateFilter}
          GROUP BY student_id
        )
        SELECT 
          s.id, s.name, s.admission_number, ss.roll_number,
          COALESCE(st.present_count, 0) as present,
          COALESCE(st.absent_count, 0) as absent,
          COALESCE(st.leave_count, 0) as leave,
          COALESCE(st.late_count, 0) as late,
          COALESCE(st.total_marked, 0) as total_days
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        LEFT JOIN stats st ON s.id = st.student_id
        WHERE ss.grade = $3 AND ss.section = $4 
          AND ss.session_id = $1 AND ss.school_id = $2
          AND ss.status = 'active'
        ORDER BY s.name
      `;

      const { rows } = await pool.query(query, queryParams);

      // Calculate Percentage
      const report = rows.map(r => {
        const total = parseInt(r.total_days);
        const present = parseInt(r.present) + parseInt(r.late); // Late counts as present
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
        return {
          studentId: r.id,
          name: r.name,
          admissionNumber: r.admission_number,
          rollNumber: r.roll_number,
          present: r.present,
          absent: r.absent,
          leave: r.leave,
          late: r.late,
          total: total,
          percentage: percentage + '%'
        };
      });

      res.json(report);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch attendance summary' });
    }
  });

  // Fetch Attendance for a specific Date & Class (Fix: List all students, even if not marked)
  app.get('/api/attendance', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    const { date, classId, sessionId } = req.query;

    if (!date || !classId) return res.status(400).json({ message: 'Date and Class ID required' });

    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        targetSessionId = schoolRes.rows[0]?.current_session_id;
      }
      if (!targetSessionId) return res.status(400).json({ message: 'No active session' });

      // We only want students from the class
      // First get the grade/section of this classId
      const classRow = await pool.query('SELECT grade, section FROM classes WHERE id = $1', [classId]);
      if (classRow.rows.length === 0) return res.status(404).json({ message: 'Class not found' });
      const { grade, section } = classRow.rows[0];

      // Join students + attendance
      // Issue: We want ALL students, even if no attendance record exists for that date (marked as null)
      const query = `
        SELECT 
          s.id as "studentId", s.name, s.admission_number as "admissionNumber", ss.roll_number as "rollNumber",
          a.status
        FROM students s
        JOIN student_sessions ss ON s.id = ss.student_id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $3 AND a.session_id = $4
        WHERE ss.grade = $1 AND ss.section = $2
          AND ss.session_id = $4 AND ss.school_id = $5
          AND ss.status = 'active'
        ORDER BY ss.roll_number ASC, s.name ASC
      `;

      const { rows } = await pool.query(query, [grade, section, date, targetSessionId, user.schoolId]);

      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch attendance' });
    }
  });

  // Assign Auto Roll Numbers
  app.post('/api/classes/assign-roll-numbers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
      const { classId } = req.body;
      // Get class details
      const clsRes = await client.query('SELECT grade, section FROM classes WHERE id = $1', [classId]);
      if (clsRes.rows.length === 0) return res.status(404).json({ message: 'Class not found' });
      const { grade, section } = clsRes.rows[0];

      // Get Session
      const sessionRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      const sessionId = sessionRes.rows[0].current_session_id;

      await client.query('BEGIN');

      // 1. Fetch current students sorted by Name
      const studentsRes = await client.query(`
              SELECT s.id, ss.id as session_record_id
              FROM students s
              JOIN student_sessions ss ON s.id = ss.student_id
              WHERE ss.grade = $1 AND ss.section = $2 AND ss.session_id = $3 AND ss.school_id = $4
              ORDER BY s.name ASC
          `, [grade, section, sessionId, user.schoolId]);

      // 2. Update each roll number
      let roll = 1;
      for (const row of studentsRes.rows) {
        await client.query('UPDATE student_sessions SET roll_number = $1 WHERE id = $2', [String(roll++), row.session_record_id]);
      }

      await client.query('COMMIT');
      res.json({ message: `Assigned roll numbers to ${studentsRes.rows.length} students` });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ message: 'Failed to assign roll numbers' });
    } finally {
      client.release();
    }
  });


  // [NEW] Get Absentee List for a specific date
  app.get('/api/attendance/absent', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    if (!user.schoolId) return res.status(400).json({ message: "School ID required" });

    const { date: reportDate, sessionId } = req.query;
    if (!reportDate) return res.status(400).json({ message: "Date is required" });

    try {
      const query = `
        SELECT 
          s.name as student_name,
          s.admission_number,
          s.father_name,
          s.mobile_number,
          ss.grade,
          ss.section,
          ss.roll_number,
          a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN student_sessions ss ON s.id = ss.student_id
        WHERE a.school_id = $1
          AND a.date = $2
          AND a.status IN ('Absent', 'Leave')
          AND ss.session_id = $3
        ORDER BY ss.grade, ss.section, s.name
      `;

      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        targetSessionId = schoolRes.rows[0]?.current_session_id;

        // Fallback: Find latest active session
        if (!targetSessionId) {
          const sessionRes = await pool.query(
            'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
            [user.schoolId]
          );
          if (sessionRes.rows.length > 0) {
            targetSessionId = sessionRes.rows[0].id;
          }
        }
      }

      if (!targetSessionId) return res.status(400).json({ message: "Session not found" });

      const { rows } = await pool.query(query, [user.schoolId, reportDate, targetSessionId]);
      res.json(rows.map(row => ({
        name: row.student_name,
        admissionNumber: row.admission_number,
        fatherName: row.father_name,
        mobileNumber: row.mobile_number,
        className: `${row.grade}-${row.section}`,
        rollNumber: row.roll_number,
        status: row.status
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch absentee list' });
    }
  });

  app.post('/api/attendance', requireAuth, requireFeature('attendance'), async (req, res) => {
    const user = (req as any).user;
    const { date, classId, records } = req.body;
    // records: { studentId: string, status: string }[]

    if (!date || !records || !Array.isArray(records)) return res.status(400).json({ message: 'Invalid payload' });

    const client = await pool.connect();
    try {
      const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      const sessionId = schoolRes.rows[0]?.current_session_id;

      await client.query('BEGIN');

      for (const rec of records) {
        const id = genId();
        await client.query(`
          INSERT INTO attendance (id, student_id, date, status, session_id, marked_by, school_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (student_id, date) 
          DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = now()
        `, [id, rec.studentId, date, rec.status, sessionId, user.id, user.schoolId]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Attendance saved' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ message: 'Failed to save attendance' });
    } finally {
      client.release();
    }
  });

  // Register Backup Routes
  // Fetch potential class teachers (Users with role teacher/admin)
  app.get('/api/users/teachers', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
      // We allow admins or teachers to be class teachers
      const { rows } = await pool.query(
        "SELECT id, name, role FROM users WHERE school_id = $1 AND role IN ('teacher', 'admin', 'superadmin') ORDER BY name",
        [user.schoolId]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch teachers' });
    }
  });

  // --- Transport System Routes ---

  app.get('/api/transport/routes', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    try {
      const { rows } = await pool.query('SELECT * FROM transport_routes WHERE school_id = $1 ORDER BY name', [user.schoolId]);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to fetch transport routes' });
    }
  });

  app.post('/api/transport/routes', requireAuth, requireFeature('transport'), async (req, res) => {
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

  app.put('/api/transport/routes/:id', requireAuth, requireFeature('transport'), async (req, res) => {
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

  app.put('/api/transport/records/:id', requireAuth, requireFeature('transport'), async (req, res) => {
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

  // Assign Student to Transport (Simplified)
  app.post('/api/transport/assign', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const client = await pool.connect();
    try {
      // routeId is deprecated, now we expect transportType and yearlyFee
      const { studentId, transportType, yearlyFee } = req.body;

      if (!transportType || yearlyFee === undefined) {
        return res.status(400).json({ message: 'Transport Type and Yearly Fee are required' });
      }

      // Get current session
      const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      let sessionId = schoolRes.rows[0]?.current_session_id;

      // Fallback: Find latest active session
      if (!sessionId) {
        const sessionRes = await client.query(
          'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
          [user.schoolId]
        );
        if (sessionRes.rows.length > 0) {
          sessionId = sessionRes.rows[0].id;
        }
      }

      if (!sessionId) return res.status(400).json({ message: 'No active session' });

      await client.query('BEGIN');

      const id = genId();
      // Upsert assignment for this session
      // Note: route_id is now nullable in DB migration
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

  // Get Students with Transport Info & Fee Balance
  app.get('/api/transport/students', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;

    try {
      // Resolve Session ID: Query Param > School's Current Session > Fallback Active
      let sessionId = req.query.sessionId as string;

      if (!sessionId) {
        const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        sessionId = schoolRes.rows[0]?.current_session_id;
      }

      // Fallback: Find latest active session
      if (!sessionId) {
        const sessionRes = await pool.query(
          'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
          [user.schoolId]
        );
        if (sessionRes.rows.length > 0) {
          sessionId = sessionRes.rows[0].id;
        }
      }

      if (!sessionId) return res.json([]);

      // New simplified query: Join students, student_transport, and aggregate fees
      // We don't need routes anymore.
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

  // Record Transport Fee Payment
  app.post('/api/transport/pay', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    try {
      const { studentId, amount, paymentDate, remarks } = req.body;

      // Get current session
      const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      let sessionId = schoolRes.rows[0]?.current_session_id;

      // Fallback: Find latest active session
      if (!sessionId) {
        const sessionRes = await pool.query(
          'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
          [user.schoolId]
        );
        if (sessionRes.rows.length > 0) {
          sessionId = sessionRes.rows[0].id;
        }
      }

      if (!sessionId) return res.status(400).json({ message: 'No active session' });

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

  // Get Transport Transactions for a Student
  app.get('/api/transport/students/:studentId/transactions', requireAuth, requireFeature('transport'), async (req, res) => {
    const user = (req as any).user;
    const { studentId } = req.params;

    try {
      // Get current session
      const schoolRes = await pool.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
      let sessionId = schoolRes.rows[0]?.current_session_id;

      // Fallback: Find latest active session
      if (!sessionId) {
        const sessionRes = await pool.query(
          'SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1',
          [user.schoolId]
        );
        if (sessionRes.rows.length > 0) {
          sessionId = sessionRes.rows[0].id;
        }
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

  app.use("/api/backup", requireAuth, backupRouter);

  const httpServer = createServer(app);
  return httpServer;
}
