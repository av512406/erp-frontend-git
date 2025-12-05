
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { students, schools, grades, users } from '../shared/schema.ts';
import { eq, and } from 'drizzle-orm';


const { Pool } = pg;

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';
const pool = new Pool({ connectionString });
const db = drizzle(pool);

const BASE_URL = 'http://localhost:5000'; // Assuming app is running on port 5000

async function verify() {
    console.log('Verifying exam configuration sync...');
    let schoolId, studentId, adminToken;

    try {
        // 1. Create a test school
        const uniqueSlug = `sync-test-${Date.now()}`;
        const schoolRes = await pool.query(`
      INSERT INTO schools (id, name, slug, exam_pattern) 
      VALUES (gen_random_uuid(), 'Sync Test School', $1, '["Term A", "Term B"]') 
      RETURNING id
    `, [uniqueSlug]);
        schoolId = schoolRes.rows[0].id;
        console.log('Created test school:', schoolId);

        // 2. Create a test admin for the school to get a token
        const adminRes = await pool.query(`
      INSERT INTO users (id, username, password, role, name, school_id)
      VALUES (gen_random_uuid(), $1, 'password', 'admin', 'Admin', $2)
      RETURNING id
    `, [`admin@${uniqueSlug}.com`, schoolId]);

        // Login to get token
        const loginRes = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: `admin@${uniqueSlug}.com`, password: 'password' })
        });

        if (!loginRes.ok) throw new Error('Login failed');
        const loginData = await loginRes.json();
        adminToken = loginData.token;
        console.log('Logged in as admin');

        // 3. Create a test student
        const studentRes = await pool.query(`
      INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, aadhar_number, pen_number, aapar_id, mobile_number, address, grade, section, yearly_fee_amount, school_id)
      VALUES (gen_random_uuid(), 'SYNC_001', 'Sync Student', '2010-01-01', '2025-01-01', '1234', '5678', '9012', '9999999999', 'Address', '1', 'A', 1000, $1)
      RETURNING id
    `, [schoolId]);
        studentId = studentRes.rows[0].id;
        console.log('Created test student:', studentId);

        // 4. Insert grades for "Term A"
        await pool.query(`
      INSERT INTO grades (id, student_id, subject, marks, term, school_id)
      VALUES (gen_random_uuid(), $1, 'Math', 90, 'Term A', $2)
    `, [studentId, schoolId]);
        console.log('Inserted grade for Term A');

        // 5. Update exam pattern: Rename "Term A" to "Term Alpha"
        console.log('Updating exam pattern...');
        const updateRes = await fetch(`${BASE_URL}/api/schools/${schoolId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                examPattern: ["Term Alpha", "Term B"]
            })
        });

        if (!updateRes.ok) {
            const err = await updateRes.text();
            throw new Error(`Update failed: ${err}`);
        }
        console.log('Exam pattern updated');

        // 6. Verify grades have been updated
        const gradeRes = await pool.query(`
      SELECT term FROM grades WHERE student_id = $1 AND subject = 'Math'
    `, [studentId]);

        if (gradeRes.rows.length > 0 && gradeRes.rows[0].term === 'Term Alpha') {
            console.log('SUCCESS: Grade term updated to "Term Alpha"');
        } else {
            console.error('FAILURE: Grade term is', gradeRes.rows[0]?.term);
            process.exit(1);
        }

    } catch (e) {
        console.error('Verification Failed:', e);
        process.exit(1);
    } finally {
        // Cleanup
        if (schoolId) {
            console.log('Cleaning up...');
            await pool.query('DELETE FROM grades WHERE school_id = $1', [schoolId]);
            await pool.query('DELETE FROM students WHERE school_id = $1', [schoolId]);
            await pool.query('DELETE FROM users WHERE school_id = $1', [schoolId]);
            await pool.query('DELETE FROM schools WHERE id = $1', [schoolId]);
        }
        await pool.end();
    }
}

verify();
