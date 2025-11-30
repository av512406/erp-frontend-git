
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp'
});

async function main() {
    try {
        const client = await pool.connect();

        // Check user
        const userRes = await client.query("SELECT * FROM users WHERE username = 'admin@school.edu'");
        if (userRes.rows.length === 0) {
            console.log('User admin@school.edu not found');
            return;
        }
        const user = userRes.rows[0];
        console.log('User:', user.username, 'School ID:', user.school_id);

        // Check school
        const schoolRes = await client.query("SELECT * FROM schools WHERE id = $1", [user.school_id]);
        if (schoolRes.rows.length === 0) {
            console.log('School not found for ID:', user.school_id);
        } else {
            const school = schoolRes.rows[0];
            console.log('School:', school.name, 'ID:', school.id, 'Is Active:', school.is_active);
        }

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
