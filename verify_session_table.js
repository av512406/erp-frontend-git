import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://school_erp:school_erp_pass@localhost:15432/school_erp',
});

async function verify() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT to_regclass('public.session')");
        if (res.rows[0].to_regclass) {
            console.log('SUCCESS: session table exists.');
            const count = await client.query('SELECT count(*) FROM session');
            console.log(`Session count: ${count.rows[0].count}`);
        } else {
            console.error('FAILURE: session table does NOT exist.');
        }
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
