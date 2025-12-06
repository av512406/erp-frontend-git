
import { pool } from './server/db';

async function listSessions() {
    try {
        const res = await pool.query("SELECT * FROM academic_sessions");
        console.log("Sessions found:", res.rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

listSessions();
