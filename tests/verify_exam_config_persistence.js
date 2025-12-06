
// import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
// import { students, schools, grades, users } from '../shared/schema.ts';
// import { eq, and } from 'drizzle-orm';
import http from 'http';

const { Pool } = pg;

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:5432/school_erp';
const pool = new Pool({ connectionString });
// const db = drizzle(pool);

const PORT = 5000;
const HOST = 'localhost';

function makeRequest(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed, text: data });
                } catch (e) {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: null, text: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function verifyPersistence() {
    console.log('Verifying exam configuration persistence...');
    let schoolId, adminToken;

    try {
        // 1. Create a test school
        const uniqueSlug = `persist-test-${Date.now()}`;
        const schoolRes = await pool.query(`
      INSERT INTO schools (id, name, slug, exam_pattern) 
      VALUES (gen_random_uuid(), 'Persistence Test School', $1, '["Term 1", "Term 2"]') 
      RETURNING id
    `, [uniqueSlug]);
        schoolId = schoolRes.rows[0].id;
        console.log('Created test school:', schoolId);

        // 2. Create a test admin
        await pool.query(`
      INSERT INTO users (id, username, password, role, name, school_id)
      VALUES (gen_random_uuid(), $1, 'password', 'admin', 'Admin', $2)
    `, [`admin@${uniqueSlug}.com`, schoolId]);

        // 3. Login
        const loginRes = await makeRequest('POST', '/api/login', { username: `admin@${uniqueSlug}.com`, password: 'password' });

        if (!loginRes.ok) throw new Error('Login failed');
        adminToken = loginRes.data.token;
        console.log('Logged in as admin');

        // 4. Update exam pattern
        const newPattern = ["Term A", "Term B", "Term C"];
        console.log('Updating exam pattern to:', newPattern);

        const updateRes = await makeRequest('PUT', `/api/schools/${schoolId}`, { examPattern: newPattern }, { 'Authorization': `Bearer ${adminToken}` });

        if (!updateRes.ok) {
            throw new Error(`Update failed: ${updateRes.text}`);
        }
        console.log('Update API call successful');

        // 5. Verify persistence in Database
        const dbRes = await pool.query('SELECT exam_pattern FROM schools WHERE id = $1', [schoolId]);
        const dbPattern = dbRes.rows[0].exam_pattern;
        const parsedDbPattern = typeof dbPattern === 'string' ? JSON.parse(dbPattern) : dbPattern;

        console.log('Database pattern:', parsedDbPattern);

        if (JSON.stringify(parsedDbPattern) === JSON.stringify(newPattern)) {
            console.log('PASS: Exam pattern persisted correctly in DB.');
        } else {
            console.error('FAIL: Database pattern does not match updated pattern.');
            process.exit(1);
        }

        // 6. Verify retrieval via API
        const fetchRes = await makeRequest('GET', `/api/schools/${schoolId}`, null, { 'Authorization': `Bearer ${adminToken}` });

        if (fetchRes.ok) {
            const apiPattern = fetchRes.data.examPattern;
            console.log('API fetched pattern:', apiPattern);

            if (JSON.stringify(apiPattern) === JSON.stringify(newPattern)) {
                console.log('PASS: API returns updated pattern.');
            } else {
                console.error('FAIL: API returned stale or incorrect pattern.');
                process.exit(1);
            }
        } else {
            console.warn("Could not fetch school details via /api/schools/:id. Trying /api/school-config");
            const configRes = await makeRequest('GET', '/api/school-config', null, { 'Authorization': `Bearer ${adminToken}` });
            if (configRes.ok) {
                console.log('Config API fetched pattern:', configRes.data.examPattern);
                if (JSON.stringify(configRes.data.examPattern) === JSON.stringify(newPattern)) {
                    console.log('PASS: Config API returns updated pattern.');
                } else {
                    console.error('FAIL: Config API returned stale pattern.');
                    process.exit(1);
                }
            } else {
                throw new Error("Failed to fetch school config via API");
            }
        }

    } catch (e) {
        console.error('Verification Failed:', e);
        process.exit(1);
    } finally {
        // Cleanup
        if (schoolId) {
            console.log('Cleaning up...');
            await pool.query('DELETE FROM users WHERE school_id = $1', [schoolId]);
            await pool.query('DELETE FROM schools WHERE id = $1', [schoolId]);
        }
        await pool.end();
    }
}

verifyPersistence();
