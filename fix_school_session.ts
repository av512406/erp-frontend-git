
import { pool } from './server/db';

async function fixSchoolSession() {
    try {
        const schoolId = '915120d6-5f85-4fc2-acd2-f776013fc108';
        const sessionId = '30a6912d-52bb-4939-a172-ed07f160958a';
        await pool.query("UPDATE schools SET current_session_id = $1 WHERE id = $2", [sessionId, schoolId]);
        console.log("School session updated");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

fixSchoolSession();
