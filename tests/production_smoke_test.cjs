
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

async function runTests() {
    console.log('Starting Production Smoke Test...');

    try {
        // 1. Login
        console.log('1. Logging in...');
        const loginRes = request('POST', '/login', { username: 'admin@demo.com', password: 'admin@demo.com' }); // Assuming default creds or I need to use the ones from the user
        if (!loginRes.token) {
            // Try with the credentials I know work: admin@demo.com / admin@demo.com
            // If that fails, I might need to ask user or check my previous steps
            throw new Error(`Login failed: ${JSON.stringify(loginRes)}`);
        }
        TOKEN = loginRes.token;
        console.log('   Login successful.');

        // 2. Fetch Students
        console.log('2. Fetching students...');
        const students = request('GET', '/students');
        if (!Array.isArray(students)) {
            throw new Error(`Failed to fetch students: ${JSON.stringify(students)}`);
        }
        console.log(`   Fetched ${students.length} students.`);

        // 3. Fetch Subjects (Verify my fix)
        console.log('3. Fetching subjects...');
        const subjects = request('GET', '/subjects');
        if (!Array.isArray(subjects)) {
            throw new Error(`Failed to fetch subjects: ${JSON.stringify(subjects)}`);
        }
        console.log(`   Fetched ${subjects.length} subjects.`);

        // 4. Create a Test Subject (Verify my fix)
        console.log('4. Creating test subject...');
        const testSubject = { code: 'SMOKE_TEST', name: 'Smoke Test Subject' };
        // Check if exists first
        const existing = subjects.find(s => s.code === testSubject.code);
        if (existing) {
            console.log('   Subject already exists, deleting first...');
            request('DELETE', `/subjects/${existing.id}`);
        }

        const createdSubject = request('POST', '/subjects', testSubject);
        if (!createdSubject.id) {
            throw new Error(`Failed to create subject: ${JSON.stringify(createdSubject)}`);
        }
        console.log('   Created subject ID:', createdSubject.id);

        // 5. Verify Subject Exists
        console.log('5. Verifying subject exists...');
        const updatedSubjects = request('GET', '/subjects');
        const foundSubject = updatedSubjects.find(s => s.id === createdSubject.id);
        if (!foundSubject) {
            throw new Error('Subject not found after creation');
        }
        console.log('   Subject verified.');

        // 6. Cleanup Subject
        console.log('6. Cleaning up subject...');
        request('DELETE', `/subjects/${createdSubject.id}`);
        console.log('   Cleanup complete.');

        console.log('✅ PRODUCTION SMOKE TEST PASSED');

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

runTests();
