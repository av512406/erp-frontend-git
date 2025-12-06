
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
        console.log('Checking Subjects API...');

        // 1. Login
        const loginRes = request('POST', '/login', { username: 'admin@demo.com', password: 'admin@demo.com' });
        if (!loginRes.token) throw new Error('Login failed');
        TOKEN = loginRes.token;
        console.log('Login successful.');

        // 2. Fetch Subjects for Class 1
        console.log('Fetching subjects for Class 1...');
        const subjects = request('GET', '/classes/1/subjects');
        console.log('Subjects response:', JSON.stringify(subjects, null, 2));

        if (Array.isArray(subjects) && subjects.length > 0) {
            console.log(`✅ Found ${subjects.length} subjects.`);
        } else {
            console.log('❌ No subjects found or invalid response.');
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    }
}

run();
