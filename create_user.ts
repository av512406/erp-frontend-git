
import { pool, genId } from './server/db';

async function createUser() {
    try {
        const schoolId = '915120d6-5f85-4fc2-acd2-f776013fc108'; // Demo school
        const id = genId();
        await pool.query(
            "INSERT INTO users (id, username, password, role, name, school_id) VALUES ($1, $2, $3, $4, $5, $6)",
            [id, 'admin@demo.com', 'admin@demo.com', 'admin', 'Admin Demo', schoolId]
        );
        console.log("User admin@demo.com created");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

createUser();
