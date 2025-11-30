import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://school_erp:school_erp_pass@localhost:15432/school_erp',
});

async function verify() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM students WHERE father_name IS NOT NULL LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Database row:', res.rows[0]);
            if (res.rows[0].father_name !== undefined) {
                console.log('SUCCESS: father_name column exists in database.');
            } else {
                console.error('FAILURE: father_name column missing in database.');
            }
        } else {
            console.log('No students found in database.');
        }
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
