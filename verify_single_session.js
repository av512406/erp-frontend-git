import http from 'http';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://school_erp:school_erp_pass@localhost:15432/school_erp',
});

async function getUser() {
    const client = await pool.connect();
    let user;
    try {
        const res = await client.query("SELECT username, password FROM users LIMIT 1");
        if (res.rows.length > 0) {
            user = res.rows[0];
        }
    } finally {
        client.release();
        await pool.end();
    }
    return user;
}

function login(user) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 80,
            path: '/api/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const cookies = res.headers['set-cookie'];
                    if (cookies) {
                        resolve(cookies[0].split(';')[0]);
                    } else {
                        reject('No cookies received');
                    }
                } else {
                    reject(`Login failed: ${res.statusCode}`);
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify({ username: user.username, password: user.password }));
        req.end();
    });
}

function checkSession(cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 80,
            path: '/api/me',
            method: 'GET',
            headers: {
                'Cookie': cookie
            }
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode);
        });

        req.on('error', reject);
        req.end();
    });
}

async function verify() {
    try {
        const user = await getUser();
        if (!user) {
            console.error('No user found');
            return;
        }
        console.log(`Testing with user: ${user.username}`);

        // 1. Login Session A
        console.log('Logging in Session A...');
        const cookieA = await login(user);
        console.log('Session A Cookie:', cookieA);

        // 2. Verify Session A
        const statusA1 = await checkSession(cookieA);
        console.log(`Session A Status (Initial): ${statusA1}`);
        if (statusA1 !== 200) throw new Error('Session A failed initially');

        // 3. Login Session B
        console.log('Logging in Session B...');
        const cookieB = await login(user);
        console.log('Session B Cookie:', cookieB);

        // 4. Verify Session B
        const statusB = await checkSession(cookieB);
        console.log(`Session B Status: ${statusB}`);
        if (statusB !== 200) throw new Error('Session B failed');

        // 5. Verify Session A (Should fail)
        const statusA2 = await checkSession(cookieA);
        console.log(`Session A Status (After B login): ${statusA2}`);

        if (statusA2 === 401) {
            console.log('SUCCESS: Session A was invalidated.');
        } else {
            console.error(`FAILURE: Session A is still valid (Status: ${statusA2})`);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verify();
