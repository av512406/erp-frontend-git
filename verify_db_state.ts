
import { pool } from './server/db';

async function verify() {
    try {
        const userRes = await pool.query("SELECT * FROM users WHERE username = 'admin@demo.com'");
        if (userRes.rows.length === 0) {
            console.log("User admin@demo.com not found");
            return;
        }
        const user = userRes.rows[0];
        console.log("User found:", user);

        if (!user.school_id) {
            console.log("User has no school_id");
            return;
        }

        const schoolRes = await pool.query("SELECT * FROM schools WHERE id = $1", [user.school_id]);
        if (schoolRes.rows.length === 0) {
            console.log("School not found for id:", user.school_id);
        } else {
            console.log("School found:", schoolRes.rows[0]);
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

verify();
