
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';
const pool = new Pool({ connectionString });

async function migrate() {
  try {
    console.log('Adding previous_year_due column...');
    await pool.query(`
      ALTER TABLE students 
      ADD COLUMN IF NOT EXISTS previous_year_due DECIMAL(10, 2) DEFAULT '0';
    `);
    console.log('Column added successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
