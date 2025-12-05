
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { students } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';
const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function verify() {
    console.log('Verifying previousYearDue column...');
    try {
        // Try to insert a student with previousYearDue
        const newStudent = {
            admissionNumber: 'TEST_PYD_001',
            name: 'Test Student PYD',
            dateOfBirth: '2010-01-01',
            admissionDate: '2024-01-01',
            aadharNumber: '123412341234',
            penNumber: 'PEN123',
            aaparId: 'AAP123',
            mobileNumber: '9999999999',
            address: 'Test Address',
            grade: '10',
            section: 'A',
            yearlyFeeAmount: '10000',
            previousYearDue: '5000', // This is the new field
            schoolId: 'default-school-id' // Assuming this exists or we need to fetch one
        };

        // We need a valid school ID. Let's fetch one.
        const schoolsRes = await pool.query('SELECT id FROM schools LIMIT 1');
        if (schoolsRes.rows.length > 0) {
            newStudent.schoolId = schoolsRes.rows[0].id;
        } else {
            // Create a dummy school if none exists (unlikely in dev)
            const s = await pool.query("INSERT INTO schools (name, slug) VALUES ('Test School', 'test-school') RETURNING id");
            newStudent.schoolId = s.rows[0].id;
        }

        // Insert
        await db.insert(students).values(newStudent);
        console.log('Inserted student with previousYearDue successfully.');

        // Fetch back to verify
        const fetched = await db.select().from(students).where(eq(students.admissionNumber, 'TEST_PYD_001'));
        if (fetched.length > 0 && parseFloat(fetched[0].previousYearDue) === 5000) {
            console.log('Verification Passed: previousYearDue is stored and retrieved correctly.');
        } else {
            console.error('Verification Failed: previousYearDue not found or incorrect.', fetched[0]);
            process.exit(1);
        }

        // Cleanup
        await db.delete(students).where(eq(students.admissionNumber, 'TEST_PYD_001'));

    } catch (e) {
        console.error('Verification Failed:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();
