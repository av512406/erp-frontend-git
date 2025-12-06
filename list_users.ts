
import { pool } from './server/db';

async function listUsers() {
    try {
        const res = await pool.query("SELECT id, username, role, school_id FROM users");
        console.log("Users found:", res.rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

listUsers();
