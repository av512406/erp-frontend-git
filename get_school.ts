
import { pool } from './server/db';

async function getSchool() {
    try {
        const res = await pool.query("SELECT * FROM schools WHERE id = '915120d6-5f85-4fc2-acd2-f776013fc108'");
        console.log("School found:", res.rows[0]);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

getSchool();
