
const { execSync } = require('child_process');

const BASE_URL = 'https://school.edulekha.in/api';
let TOKEN = '';

function request(method, path, data) {
    const url = `${BASE_URL}${path}`;
    let cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json"`;

    if (TOKEN) {
        cmd += ` -H "Authorization: Bearer ${TOKEN}"`;
    }

    if (data) {
        const json = JSON.stringify(data).replace(/'/g, "'\\''");
        cmd += ` -d '${json}'`;
    }

    try {
        const output = execSync(cmd).toString();
        try {
            return JSON.parse(output);
        } catch (e) {
            return output;
        }
    } catch (e) {
        throw new Error(`Command failed: ${cmd}\nError: ${e.message}`);
    }
}

async function run() {
    try {
        // Login
        const loginRes = request('POST', '/login', { username: 'admin@demo.com', password: 'admin@demo.com' });
        if (!loginRes.token) throw new Error('Login failed');
        TOKEN = loginRes.token;

        // Fetch Sessions
        const sessions = request('GET', '/sessions');
        console.log('Available Sessions:', JSON.stringify(sessions, null, 2));

        // Fetch Current School Config to see current session
        const config = request('GET', '/school-config');
        console.log('Current School Config:', JSON.stringify(config, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
