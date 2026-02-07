import { db, pool, genId } from '../db';
import { students, studentSessions, schools, classes, academicSessions, insertStudentSchema } from '@shared/schema';
import { eq, and, or, ilike, sql, count } from 'drizzle-orm';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { mapStudent } from '../lib/mappers';
import { ZodError } from 'zod';

const router = Router();

router.get('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { sessionId } = req.query;

    try {
        // Resolve Session ID
        let targetSessionId = sessionId as string;
        if (!targetSessionId) {
            // Fetch school's current session
            const schoolRes = await db.select({ currentSessionId: schools.currentSessionId })
                .from(schools)
                .where(eq(schools.id, user.schoolId))
                .limit(1);

            targetSessionId = schoolRes[0]?.currentSessionId || '';

            if (!targetSessionId) {
                // Fallback to latest active academic session
                const sessionRes = await db.select({ id: academicSessions.id })
                    .from(academicSessions)
                    .where(and(eq(academicSessions.isActive, true), eq(academicSessions.schoolId, user.schoolId))) // Assuming schoolId needed if strictly multi-tenant, else remove schoolId check if sessions global
                    .orderBy(sql`${academicSessions.endDate} DESC`) // Order by date desc
                    .limit(1);

                if (sessionRes.length > 0) {
                    targetSessionId = sessionRes[0].id;
                }
            }
        }

        if (!targetSessionId) {
            return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } });
        }

        const page = req.query.page ? parseInt(req.query.page as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const grade = req.query.grade as string;
        const section = req.query.section as string;
        const searchTerm = req.query.q as string;

        // Build Conditions
        const filters = [
            eq(studentSessions.sessionId, targetSessionId),
            eq(studentSessions.schoolId, user.schoolId),
            or(eq(studentSessions.status, 'active'), eq(studentSessions.status, 'promoted'))
        ];

        if (grade && grade !== 'all') {
            filters.push(eq(studentSessions.grade, grade));
        }

        if (section && section !== 'all') {
            filters.push(eq(studentSessions.section, section));
        }

        if (user.role === 'teacher') {
            const classRes = await db.select({ grade: classes.grade, section: classes.section })
                .from(classes)
                .where(eq(classes.classTeacherId, user.id))
                .limit(1);

            if (classRes.length === 0) {
                return res.json({ data: [], meta: { total: 0, page: 1, limit: 10 } });
            }
            const assigned = classRes[0];
            filters.push(eq(studentSessions.grade, assigned.grade));
            filters.push(eq(studentSessions.section, assigned.section));
        }

        if (searchTerm) {
            const q = `%${searchTerm}%`;
            filters.push(or(
                ilike(students.name, q),
                ilike(students.admissionNumber, q)
            ));
        }

        const whereClause = and(...filters);

        // Fetch Data
        if (page && limit) {
            const offset = (page - 1) * limit;

            // Count Total
            const countRes = await db.select({ value: count() })
                .from(students)
                .innerJoin(studentSessions, eq(students.id, studentSessions.studentId))
                .where(whereClause);

            const total = countRes[0].value;

            // Fetch Page
            const rows = await db.select({
                student: students,
                session: studentSessions,
                academicSession: academicSessions
            })
                .from(students)
                .innerJoin(studentSessions, eq(students.id, studentSessions.studentId))
                .leftJoin(academicSessions, eq(studentSessions.sessionId, academicSessions.id))
                .where(whereClause)
                .orderBy(studentSessions.grade, studentSessions.section, students.name)
                .limit(limit)
                .offset(offset);

            const mapped = rows.map(({ student, session, academicSession }: any) => ({
                ...mapStudent(student),
                // Overlay session specific data
                grade: session.grade,
                section: session.section,
                status: session.status,
                rollNumber: session.rollNumber,
                transportFee: session.transportFee || '0',
                yearlyFeeAmount: session.yearlyFeeAmount || '0',
                isRTE: session.isRTE || false,
                sessionId: session.sessionId,
                sessionName: academicSession?.name || ''
            }));

            return res.json({
                data: mapped,
                meta: { total, page, limit }
            });
        } else {
            // No Pagination
            const rows = await db.select({
                student: students,
                session: studentSessions,
                academicSession: academicSessions
            })
                .from(students)
                .innerJoin(studentSessions, eq(students.id, studentSessions.studentId))
                .leftJoin(academicSessions, eq(studentSessions.sessionId, academicSessions.id))
                .where(whereClause)
                .orderBy(studentSessions.grade, studentSessions.section, students.name);

            const mapped = rows.map(({ student, session, academicSession }: any) => ({
                ...mapStudent(student),
                grade: session.grade?.trim(),
                section: session.section?.trim(),
                status: session.status,
                rollNumber: session.rollNumber,
                transportFee: session.transportFee || '0',
                yearlyFeeAmount: session.yearlyFeeAmount || '0',
                isRTE: session.isRTE || false,
                sessionId: session.sessionId,
                sessionName: academicSession?.name || ''
            }));

            res.json(mapped);
        }
    } catch (e) {
        console.error('Error fetching students:', e);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
});

router.get('/api/sessions/:id/candidates', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const targetSessionId = req.params.id;
    const { sourceSessionId } = req.query;

    if (!sourceSessionId) return res.status(400).json({ message: 'sourceSessionId required' });

    try {
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

router.post('/api/students/promote', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { targetSessionId, students } = req.body;

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

            // Also update the main students table to reflect the current grade/section
            await client.query(
                `UPDATE students SET grade = $1, section = $2 WHERE id = $3 AND school_id = $4`,
                [s.grade, s.section, s.studentId, user.schoolId]
            );

            inserted.push(s.studentId);
        }

        await client.query('COMMIT');
        res.json({ message: `Promoted/Imported ${inserted.length} students` });
    } catch (e) {
        res.status(500).json({ message: 'Failed to fetch absentee list' });
    }
});

router.post('/api/students', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertStudentSchema.parse(req.body);

        // Priority: Use sessionId from request body, fallback to school's current session
        let sessionId = (req.body as any).sessionId;

        if (!sessionId) {
            const schoolRes = await db.select({ currentSessionId: schools.currentSessionId })
                .from(schools)
                .where(eq(schools.id, user.schoolId))
                .limit(1);
            sessionId = schoolRes[0]?.currentSessionId;
        }

        if (!sessionId) {
            return res.status(400).json({
                message: 'No academic session specified. Please select a session or set an active session for the school.'
            });
        }

        // Verify the session belongs to this school
        const sessionCheck = await db.select({ id: academicSessions.id })
            .from(academicSessions)
            .where(and(eq(academicSessions.id, sessionId), eq(academicSessions.schoolId, user.schoolId)))
            .limit(1);

        if (sessionCheck.length === 0) {
            return res.status(400).json({
                message: 'Invalid session ID or session does not belong to your school'
            });
        }

        const result = await db.transaction(async (tx: any) => {
            // Check for existing admission number
            const exists = await tx.select({ id: students.id })
                .from(students)
                .where(and(eq(students.admissionNumber, data.admissionNumber), eq(students.schoolId, user.schoolId)))
                .limit(1);

            if (exists.length > 0) {
                // Return a specific custom error object to be caught below or just throw
                throw new Error('ADMISSION_EXISTS');
            }

            // Insert Student
            // Note: Drizzle insertSchema expects fields matching existing columns.
            // We need to exclude 'yearlyFeeAmount', 'transportFee', etc. from the insert payload to 'students' table
            // const { ...studentData } = data; // destructuring not checking types

            const studentInsert = {
                admissionNumber: data.admissionNumber,
                name: data.name,
                dateOfBirth: data.dateOfBirth,
                admissionDate: data.admissionDate,
                aadharNumber: data.aadharNumber,
                penNumber: data.penNumber,
                aaparId: data.aaparId,
                mobileNumber: data.mobileNumber,
                address: data.address,
                grade: data.grade?.trim(),
                section: data.section?.trim(),
                fatherName: (data as any).fatherName,
                motherName: (data as any).motherName,
                status: 'active',
                schoolId: user.schoolId,
                // Optional fields if in schema but might be undefined
                previousYearDue: (data as any).previousYearDue || '0',
                leavingReason: (data as any).leavingReason,
                category: (data as any).category,
                gender: (data as any).gender,
                nationality: (data as any).nationality
            };

            const insertedStudents = await tx.insert(students).values(studentInsert as any).returning();
            const newStudent = insertedStudents[0];

            const isRTE = data.isRTE === true || String(data.isRTE).toLowerCase() === 'true' || String(data.isRTE).toLowerCase() === 'yes';
            const finalYearlyFee = isRTE ? '0' : ((data as any).yearlyFeeAmount?.toString() || '0');
            const finalTransportFee = (data as any).transportFee?.toString() || '0';

            // Insert Student Session
            await tx.insert(studentSessions).values({
                studentId: newStudent.id,
                sessionId: sessionId,
                grade: data.grade?.trim(),
                section: data.section?.trim(),
                status: 'active',
                schoolId: user.schoolId,
                transportFee: finalTransportFee,
                yearlyFeeAmount: finalYearlyFee,
                isRTE: isRTE
            });

            return newStudent;
        });

        res.status(201).json(mapStudent(result));
    } catch (e: any) {
        if (e.message === 'ADMISSION_EXISTS') {
            return res.status(409).json({ message: 'admissionNumber exists' });
        }
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error('Error creating student:', e);
        res.status(500).json({ message: 'internal error' });
    }
});

router.put('/api/students/:admissionNumber', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        let admissionNumber = req.params.admissionNumber;

        // Smart detection: If it looks like a UUID, treat it as student ID and fetch admission number
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(admissionNumber);

        if (isUUID) {
            const studentRes = await db.select({ admissionNumber: students.admissionNumber })
                .from(students)
                .where(and(eq(students.id, admissionNumber), eq(students.schoolId, user.schoolId)));

            if (studentRes.length === 0) {
                return res.status(404).json({ message: 'Student not found' });
            }
            admissionNumber = studentRes[0].admissionNumber;
        }

        const data = insertStudentSchema.partial().parse(req.body);

        // Check if student exists
        const existingRes = await db.select()
            .from(students)
            .where(and(eq(students.admissionNumber, admissionNumber), eq(students.schoolId, user.schoolId)));

        if (existingRes.length === 0) {
            return res.status(404).json({ message: 'not found' });
        }
        const existingStudent = existingRes[0];

        // Prepare updates
        // Filter out session fields from student data
        const { yearlyFeeAmount, transportFee, session, sessionName, sessionId, isRTE, ...studentFields } = data as any;

        const updateResult = await db.transaction(async (tx: any) => {
            let updatedStudent = existingStudent;

            // Update Students Table if there are fields
            if (Object.keys(studentFields).length > 0) {
                const updated = await tx.update(students)
                    .set(studentFields)
                    .where(and(eq(students.admissionNumber, admissionNumber), eq(students.schoolId, user.schoolId)))
                    .returning();
                if (updated.length > 0) updatedStudent = updated[0];
            }

            // Update Student Session if sessionId provided
            let finalTransportFee = '0';
            let finalYearlyFee = '0';
            let finalIsRTE = false;

            if (sessionId) {
                const isRteBool = isRTE === true || String(isRTE).toLowerCase() === 'true' || String(isRTE).toLowerCase() === 'yes';

                // RTE Logic
                finalTransportFee = transportFee || '0';
                finalYearlyFee = isRteBool ? '0' : (yearlyFeeAmount || '0');
                finalIsRTE = isRteBool;

                const sessionUpdate: any = {
                    transportFee: finalTransportFee,
                    yearlyFeeAmount: finalYearlyFee,
                    isRTE: isRteBool
                };

                if (data.grade) sessionUpdate.grade = data.grade.trim();
                if (data.section) sessionUpdate.section = data.section.trim();

                await tx.update(studentSessions)
                    .set(sessionUpdate)
                    .where(and(
                        eq(studentSessions.studentId, updatedStudent.id),
                        eq(studentSessions.sessionId, sessionId),
                        eq(studentSessions.schoolId, user.schoolId)
                    ));
            } else {
                // If no session ID provided, we might still want to return current fee info if possible?
                // Or just return 0s if not updated.
                // The legacy code only updated session if sessionId provided.
            }

            // Return combined object
            // We need to fetch the session data again or confirm passing it?
            // Legacy code manually constructed the return
            return {
                ...updatedStudent,
                transportFee: sessionId ? finalTransportFee : 'unknown', // or optional
                yearlyFeeAmount: sessionId ? finalYearlyFee : 'unknown',
            };
        });

        // We might need to conform to mapStudent expectations or just map the result
        const mapped = mapStudent(updateResult);
        // Ensure fee fields are set if mapStudent didn't pick them up (mapStudent expects raw or camel if we updated logic)
        // Drizzle result `updatedStudent` is camelCase. `mapStudent` handles camelCase now.
        // But `transportFee` et al are not on `updatedStudent` (the table row), they are overlaid.
        // `updateResult` has them.
        (mapped as any).transportFee = (updateResult as any).transportFee;
        (mapped as any).yearlyFeeAmount = (updateResult as any).yearlyFeeAmount;

        res.json(mapped);

    } catch (e: any) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error('Error updating student:', e);
        res.status(500).json({ message: 'internal error' });
    }
});

// Alternative route: Update student by ID (UUID) instead of admission number
router.put('/api/students/by-id/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const id = req.params.id;

        // Get student's admission number first
        const studentRes = await pool.query(
            'SELECT admission_number FROM students WHERE id = $1 AND school_id = $2',
            [id, user.schoolId]
        );

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const admissionNumber = studentRes.rows[0].admission_number;

        // Reuse the existing update logic by setting params.admissionNumber
        req.params.admissionNumber = admissionNumber;

        // Now process the update using the same logic
        const data = insertStudentSchema.partial().parse(req.body);
        const existing = await pool.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'not found' });

        const keys = Object.keys(data);
        const values: any[] = [];
        const sets: string[] = [];
        const excludedKeys = ['yearlyFeeAmount', 'transportFee', 'session', 'sessionName', 'sessionId', 'isRTE'];
        keys.forEach((k, i) => {
            if (excludedKeys.includes(k)) return;
            const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^admission_number$/, 'admission_number');
            sets.push(`${col} = $${i + 1}`);
            values.push((data as any)[k]);
        });

        let q;
        if (sets.length > 0) {
            values.push(admissionNumber);
            values.push(user.schoolId);
            q = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE admission_number = $${sets.length + 1} AND school_id = $${sets.length + 2} RETURNING *`, values);
        } else {
            q = { rows: [existing.rows[0]] };
        }

        const { sessionId, transportFee, yearlyFeeAmount, isRTE } = req.body;
        const isRteBool = isRTE === true || String(isRTE).toLowerCase() === 'true';

        if (sessionId) {
            // RTE waives ONLY tuition fees, not transport fees
            const finalTransportFee = transportFee || 0; // Transport fee applies to all students
            const finalYearlyFee = isRteBool ? 0 : (yearlyFeeAmount || 0);

            const sessionSets: string[] = [`transport_fee = $1`, `yearly_fee_amount = $2`, `is_rte = $3`];
            const sessionValues: any[] = [finalTransportFee, finalYearlyFee, isRteBool];
            let valIdx = 4;

            if (data.grade) {
                sessionSets.push(`grade = $${valIdx++}`);
                sessionValues.push(data.grade);
            }
            if (data.section) {
                sessionSets.push(`section = $${valIdx++}`);
                sessionValues.push(data.section);
            }

            sessionValues.push(existing.rows[0].id);
            sessionValues.push(sessionId);
            sessionValues.push(user.schoolId);

            await pool.query(
                `UPDATE student_sessions SET ${sessionSets.join(', ')} WHERE student_id = $${valIdx} AND session_id = $${valIdx + 1} AND school_id = $${valIdx + 2}`,
                sessionValues
            );
        }

        const updated = mapStudent(q.rows[0]);
        (updated as any).transportFee = transportFee || '0';
        (updated as any).yearlyFeeAmount = yearlyFeeAmount || '0';

        res.json(updated);
    } catch (e) {
        if (e instanceof ZodError) return res.status(400).json({ message: 'validation', issues: e.format() });
        console.error(e);
        res.status(500).json({ message: 'internal error' });
    }
});

router.delete('/api/students/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = req.params.id;
    try {
        await db.delete(students)
            .where(and(eq(students.id, id), eq(students.schoolId, user.schoolId)));

        res.json({ deleted: id });
    } catch (e: any) {
        if (e.code === '23503') {
            // Check specific tables to give a helpful error message
            // Dynamic import of modules if needed or query blindly?
            // Since we don't have all tables imported, we can query raw SQL or rely on imported schema if we update imports.
            // Let's use raw SQL for checks to avoid importing everything if not needed, OR better, update imports.
            // We'll update imports in a separate/preceding step if possible. For now, let's assume we can use db.execute(sql) for checks.

            // Actually, we can just use sql`` helper.
            const feeCheck = await db.execute(sql`SELECT count(*) as c FROM fee_transactions WHERE student_id = ${id}`);
            const transportFeeCheck = await db.execute(sql`SELECT count(*) as c FROM transport_fee_transactions WHERE student_id = ${id}`);

            const feeCount = parseInt(feeCheck.rows[0]?.c?.toString() || '0');
            const transportFeeCount = parseInt(transportFeeCheck.rows[0]?.c?.toString() || '0');

            const parts = [];
            if (feeCount > 0) parts.push(`${feeCount} Fee Transaction(s)`);
            if (transportFeeCount > 0) parts.push(`${transportFeeCount} Transport Fee Transaction(s)`);

            const msg = parts.length > 0
                ? `Cannot delete: Student has ${parts.join(' and ')}. Please delete these financial records first.`
                : `Cannot delete: Student has related records in table '${e.table || 'unknown'}' (Foreign Key Constraint).`;

            return res.status(409).json({ message: msg });
        }
        console.error('Delete student error:', e);
        res.status(500).json({ message: 'Failed to delete student' });
    }
});

router.post('/api/students/import', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { students: imported, strategy, targetSessionId } = req.body as { students: any[]; strategy?: string; targetSessionId?: string };
    if (!Array.isArray(imported)) return res.status(400).json({ message: 'students array required' });

    const client = await pool.connect();
    try {
        let finalTargetSessionId = targetSessionId;

        // Fallback: Resolve Session ID if not provided
        if (!finalTargetSessionId || finalTargetSessionId === 'default') {
            const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
            finalTargetSessionId = schoolRes.rows[0]?.current_session_id;
        }

        if (!finalTargetSessionId) {
            // Second fallback: latest active session
            const sessionRes = await client.query('SELECT id FROM academic_sessions WHERE school_id = $1 AND is_active = true ORDER BY end_date DESC LIMIT 1', [user.schoolId]);
            finalTargetSessionId = sessionRes.rows[0]?.id;
        }

        if (!finalTargetSessionId) {
            return res.status(400).json({ message: 'targetSessionId is required for import (no active/current session found for school)' });
        }

        // Validate target session belongs to this school
        const sessionCheck = await client.query(
            'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
            [finalTargetSessionId, user.schoolId]
        );
        if (sessionCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid target session for this school' });
        }

        const allSessionsRes = await client.query('SELECT id, name FROM academic_sessions WHERE school_id = $1', [user.schoolId]);
        const sessionMap = new Map<string, string>();
        allSessionsRes.rows.forEach(row => {
            sessionMap.set(row.name.trim().toLowerCase(), row.id);
        });

        // Use targetSessionId (resolved)

        await client.query('BEGIN');
        const added: any[] = [];
        const skipped: string[] = [];
        let updated = 0;
        const existingClasses = new Set<string>();

        for (const row of imported) {
            try {
                await client.query('SAVEPOINT row_sp');
                const data = insertStudentSchema.parse(row);

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

                const rowSessionName = (row.session || row['Session'] || row['Session Name'] || row.sessionName || '').toString().trim();
                let effectiveSessionId = finalTargetSessionId;  // Use validated targetSessionId

                if (rowSessionName) {
                    const fromMap = sessionMap.get(rowSessionName.toLowerCase());
                    if (fromMap) {
                        effectiveSessionId = fromMap;
                    } else {
                        console.warn(`Import: Session '${rowSessionName}' not found. Using fallback.`);
                    }
                }

                let studentId = null;

                const exists = await client.query('SELECT * FROM students WHERE admission_number = $1 AND school_id = $2', [data.admissionNumber, user.schoolId]);

                if ((exists.rowCount ?? 0) > 0) {
                    studentId = exists.rows[0].id;
                    if (strategy === 'upsert') {
                        await client.query(
                            `UPDATE students SET name=$1, date_of_birth=$2, admission_date=$3, aadhar_number=$4, pen_number=$5, aapar_id=$6, mobile_number=$7, address=$8, grade=$9, section=$10, father_name=$11, mother_name=$12, category=$13, gender=$14, previous_year_due=$15 WHERE admission_number=$16 AND school_id=$17`,
                            [data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', data.admissionNumber, user.schoolId]
                        );
                        updated++;
                    } else {
                        skipped.push(data.admissionNumber);
                    }
                } else {
                    studentId = genId();
                    await client.query(
                        `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, father_name, mother_name, status, category, gender, previous_year_due, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active', $15, $16, $17, $18)`,
                        [studentId, data.admissionNumber, data.name, data.dateOfBirth, data.admissionDate, data.aadharNumber || null, data.penNumber || null, data.aaparId || null, data.mobileNumber || null, data.address || null, data.grade || null, data.section || null, (data as any).fatherName || null, (data as any).motherName || null, (data as any).category || 'GEN', (data as any).gender || null, (data as any).previousYearDue || '0', user.schoolId]
                    );
                    added.push(data.admissionNumber);
                }

                const isRTE = String(data.isRTE || '').toLowerCase() === 'true' || String(data.isRTE || '').toLowerCase() === 'yes';

                // RTE waives ONLY tuition fees, not transport fees
                const finalYearlyFee = isRTE ? 0 : (data.yearlyFeeAmount || 0);
                const finalTransportFee = (data as any).transportFee || 0; // Transport fee applies to all students

                if (studentId && effectiveSessionId) {
                    const sessCheck = await client.query('SELECT 1 FROM student_sessions WHERE student_id = $1 AND session_id = $2', [studentId, effectiveSessionId]);
                    if ((sessCheck.rowCount ?? 0) === 0) {
                        await client.query(
                            `INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id, yearly_fee_amount, transport_fee, is_rte)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                            [genId(), studentId, effectiveSessionId, data.grade, data.section, 'active', user.schoolId, finalYearlyFee, finalTransportFee, isRTE]
                        );
                    } else if (strategy === 'upsert') {
                        await client.query(
                            `UPDATE student_sessions SET grade=$1, section=$2, yearly_fee_amount=$3, transport_fee=$4, is_rte=$5 WHERE student_id=$6 AND session_id=$7`,
                            [data.grade, data.section, finalYearlyFee, finalTransportFee, isRTE, studentId, effectiveSessionId]
                        );
                    }
                }

                await client.query('RELEASE SAVEPOINT row_sp');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT row_sp');
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

router.get('/api/students/withdrawn', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { sessionId } = req.query;

    if (sessionId) {
        // Session-scoped withdrawn list
        // Join with student_sessions to check status in that specific session
        const query = `
            SELECT s.* 
            FROM students s
            JOIN student_sessions ss ON s.id = ss.student_id
            WHERE ss.session_id = $1 
              AND ss.school_id = $2 
              AND ss.status = 'left'
            ORDER BY s.left_date DESC NULLS LAST, s.admission_number
        `;
        const { rows } = await pool.query(query, [sessionId, user.schoolId]);
        res.json(rows.map(mapStudent));
    } else {
        // Legacy global behavior (all students who have globally left)
        const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
        res.json(rows.map(mapStudent));
    }
});

router.put('/api/students/:admissionNumber/withdraw', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const client = await pool.connect();
    try {
        const admissionNumber = req.params.admissionNumber;
        const { leftDate, reason, sessionId } = req.body as { leftDate?: string; reason?: string; sessionId?: string };

        await client.query('BEGIN');

        const existing = await client.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'not found' });
        }

        const dateToSet = leftDate || new Date().toISOString().slice(0, 10);
        const q = await client.query('UPDATE students SET status=$1, left_date=$2, leaving_reason=$3 WHERE admission_number=$4 AND school_id=$5 RETURNING *', ['left', dateToSet, reason || null, admissionNumber, user.schoolId]);

        // Sync to target session (provided or current)
        const studentId = q.rows[0].id;
        let targetSessionId = sessionId;

        if (!targetSessionId) {
            const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
            targetSessionId = schoolRes.rows[0]?.current_session_id;
        }

        if (targetSessionId) {
            await client.query(
                `UPDATE student_sessions SET status = 'left' WHERE student_id = $1 AND session_id = $2`,
                [studentId, targetSessionId]
            );
        }

        await client.query('COMMIT');
        res.json(mapStudent(q.rows[0]));
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'failed to mark withdrawn' });
    } finally {
        client.release();
    }
});

router.put('/api/students/:admissionNumber/restore', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const client = await pool.connect();
    try {
        const admissionNumber = req.params.admissionNumber;

        await client.query('BEGIN');

        const existing = await client.query('SELECT * FROM students WHERE admission_number=$1 AND school_id=$2', [admissionNumber, user.schoolId]);
        if ((existing.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'student not found' });
        }

        const current = existing.rows[0];
        if (current.status !== 'left') {
            await client.query('ROLLBACK');
            return res.json(mapStudent(current));
        }

        const q = await client.query('UPDATE students SET status=$1, left_date=NULL, leaving_reason=NULL WHERE admission_number=$2 AND school_id=$3 RETURNING *', ['active', admissionNumber, user.schoolId]);

        // Sync to current session
        const studentId = q.rows[0].id;
        const schoolRes = await client.query('SELECT current_session_id FROM schools WHERE id = $1', [user.schoolId]);
        const currentSessionId = schoolRes.rows[0]?.current_session_id;

        if (currentSessionId) {
            await client.query(
                `UPDATE student_sessions SET status = 'active' WHERE student_id = $1 AND session_id = $2`,
                [studentId, currentSessionId]
            );
        }

        await client.query('COMMIT');
        res.json(mapStudent(q.rows[0]));
    } catch (e: any) {
        await client.query('ROLLBACK');
        console.error('restore error', e);
        res.status(500).json({ message: e?.message || 'failed to restore' });
    } finally {
        client.release();
    }
});

/**
 * Legacy aliases for backwards compatibility if frontend still uses them
 */
router.get('/api/students/left', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM students WHERE status = 'left' AND school_id = $1 ORDER BY left_date DESC NULLS LAST, admission_number", [user.schoolId]);
    res.json(rows.map(mapStudent));
});

router.put('/api/students/:admissionNumber/leave', requireAuth, async (req, res) => {
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

export const studentRouter = router;
