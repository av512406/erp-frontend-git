
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:5432/school_erp_db';
// Note: Localhost port might be different in dev, but on prod it's likely standard or internal. 
// On prod, I should use the internal docker network URL or the one provided in env.
// The user's env has DATABASE_URL set usually.

const pool = new Pool({ connectionString });

async function migrate() {
    try {
        console.log('Cleaning up duplicate class_subjects...');
        // Keep the one with the latest ID (or earliest, doesn't matter much, but let's keep one)
        await pool.query(`
      DELETE FROM class_subjects a USING class_subjects b 
      WHERE a.id < b.id AND a.grade = b.grade AND a.subject_id = b.subject_id;
    `);
        console.log('Duplicates removed.');

        console.log('Adding unique constraint to class_subjects...');
        await pool.query(`
      ALTER TABLE class_subjects 
      ADD CONSTRAINT class_subjects_grade_subject_unique UNIQUE (grade, subject_id);
    `);
        console.log('Constraint added successfully.');
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log('Constraint already exists.');
        } else {
            console.error('Migration failed:', e);
            process.exit(1);
        }
    } finally {
        await pool.end();
    }
}

migrate();
