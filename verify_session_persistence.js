import http from 'http';

const loginData = JSON.stringify({
    username: 'admin',
    password: 'adminpassword' // Assuming default admin credentials, need to verify
});

// We need to find a valid user first.
// Let's assume 'admin' exists or we can query the DB.
// For now, let's query the DB to get a valid user.

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://school_erp:school_erp_pass@localhost:15432/school_erp',
});

async function verify() {
    const client = await pool.connect();
    let user;
    try {
        const res = await client.query("SELECT username, password FROM users LIMIT 1");
        if (res.rows.length > 0) {
            user = res.rows[0];
            console.log(`Found user: ${user.username}`);
        } else {
            console.error('No users found in DB.');
            return;
        }
    } finally {
        client.release();
        // await pool.end(); // Keep pool open for later use
    }

    // Now try to login
    const options = {
        hostname: 'localhost',
        port: 80, // Accessing via Nginx
        path: '/api/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify({ username: user.username, password: user.password }))
        }
    };

    const req = http.request(options, async (res) => { // Made callback async to use await
        console.log(`Login Status: ${res.statusCode}`);
        const cookies = res.headers['set-cookie'];
        if (cookies) {
            console.log('Cookies received:', cookies);

            // Extract session cookie
            const sessionCookie = cookies[0].split(';')[0];
            const sessionId = sessionCookie.split('=')[1].split('.')[0].replace('s%3A', '');
            console.log('Session ID from cookie:', sessionId);

            // Check DB for this session
            const client2 = await pool.connect();
            try {
                const sessionRes = await client2.query("SELECT * FROM session WHERE sid = $1", [sessionId]);
                if (sessionRes.rows.length > 0) {
                    console.log('SUCCESS: Session found in DB:', sessionRes.rows[0]);
                } else {
                    console.log('FAILURE: Session NOT found in DB for ID:', sessionId);
                    // List all sessions to see if there's a mismatch
                    const allSessions = await client2.query("SELECT sid FROM session ORDER BY expire DESC LIMIT 5");
                    console.log('Recent sessions in DB:', allSessions.rows);
                }
            } finally {
                client2.release();
            }

            // Now try to access /api/me
            const meOptions = {
                hostname: 'localhost',
                port: 80,
                path: '/api/me',
                method: 'GET',
                headers: {
                    'Cookie': sessionCookie
                }
            };

            const meReq = http.request(meOptions, (meRes) => {
                console.log(`Me Status: ${meRes.statusCode}`);
                let data = '';
                meRes.on('data', (chunk) => data += chunk);
                meRes.on('end', () => {
                    console.log('Me Response:', data);
                    if (meRes.statusCode === 200) {
                        console.log('SUCCESS: Session persisted.');
                    } else {
                        console.error('FAILURE: Session NOT persisted.');
                    }
                });
            });
            meReq.end();

        } else {
            console.error('FAILURE: No cookies received on login.');
        }
    });

    req.write(JSON.stringify({ username: user.username, password: user.password }));
    req.end();
}

verify();
