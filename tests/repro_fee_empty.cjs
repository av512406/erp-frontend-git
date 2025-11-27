
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost/api';

function request(method, path, data) {
    const url = `${BASE_URL}${path}`;
    let cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json"`;

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
    console.log('Starting Empty Fee Reproduction Test...');

    const testStudent = {
        admissionNumber: "EMPTY_FEE_001",
        name: "Empty Fee Student",
        dateOfBirth: "2015-01-01",
        admissionDate: "2024-01-01",
        yearlyFeeAmount: "", // Empty string
        status: "active",
        grade: "5",
        section: "B",
        aadharNumber: "123",
        penNumber: "123",
        aaparId: "123",
        mobileNumber: "123",
        address: "123"
    };

    try {
        console.log('1. Creating student with empty fee...');
        const created = request('POST', '/students', testStudent);

        console.log('   Response:', JSON.stringify(created));

        if (created.message === 'internal error') {
            console.log('   ✅ Reproduced: Internal error (likely DB syntax error)');
        } else if (created.id) {
            console.log('   ❌ Failed to reproduce: Student created successfully');
            request('DELETE', `/students/${created.id}`);
        } else {
            console.log('   ❓ Unexpected response');
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
    }
}

runTests();
