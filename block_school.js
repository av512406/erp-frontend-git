
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp'
});

async function main() {
    try {
        const client = await pool.connect();
        await client.query("UPDATE schools SET is_active = false WHERE id = 'default-school-id'");
        console.log('Blocked GLORIOUS PUBLIC SCHOOL (default-school-id)');
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
