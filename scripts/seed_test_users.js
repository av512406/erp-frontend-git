
import { Pool } from 'pg';
// import { randomUUID } from 'crypto';
function randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';
const pool = new Pool({ connectionString });

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Seeding test users...');

        // 1. Create a Test School
        const schoolId = 'test-school-' + randomUUID();
        await client.query(`
      INSERT INTO schools (id, name, slug, is_active)
      VALUES ($1, 'UI Test School', $2, true)
      ON CONFLICT (slug) DO NOTHING
    `, [schoolId, 'ui-test-school']);

        // Get the actual ID if it existed
        const schoolRes = await client.query(`SELECT id FROM schools WHERE slug = 'ui-test-school'`);
        const actualSchoolId = schoolRes.rows[0].id;

        // 2. Create School Admin
        const adminEmail = 'admin@uitest.com';
        const adminPass = 'password123';
        await client.query(`
      INSERT INTO users (id, username, password, role, name, school_id)
      VALUES ($1, $2, $3, 'admin', 'Test Admin', $4)
      ON CONFLICT (username) DO UPDATE SET password = $3
    `, [randomUUID(), adminEmail, adminPass, actualSchoolId]);
        console.log(`School Admin: ${adminEmail} / ${adminPass}`);

        // 3. Create Super Admin
        const superEmail = 'super@uitest.com';
        const superPass = 'password123';
        await client.query(`
      INSERT INTO users (id, username, password, role, name)
      VALUES ($1, $2, $3, 'superadmin', 'Test Super Admin')
      ON CONFLICT (username) DO UPDATE SET password = $3
    `, [randomUUID(), superEmail, superPass]);
        console.log(`Super Admin: ${superEmail} / ${superPass}`);

    } catch (e) {
        console.error('Seeding failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
