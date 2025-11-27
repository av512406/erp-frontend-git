
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
    console.log('Starting Empty Fields Reproduction Test...');

    const testStudent = {
        admissionNumber: "EMPTY_FIELDS_001",
        name: "Empty Fields Student",
        dateOfBirth: "2015-01-01",
        admissionDate: "2024-01-01",
        yearlyFeeAmount: "15000",
        status: "active",
        grade: "5",
        section: "B",
        aadharNumber: "", // Empty string
        penNumber: "",    // Empty string
        aaparId: "",      // Empty string
        mobileNumber: "", // Empty string
        address: ""       // Empty string
    };

    try {
        console.log('1. Creating student with empty fields...');
        const created = request('POST', '/students', testStudent);

        // Check if we got an error
        if (created.message === 'internal error' || created.code === '23502') { // 23502 is not-null violation
            throw new Error(`Failed to create student: ${JSON.stringify(created)}`);
        }

        if (!created.id) {
            throw new Error(`Unexpected response: ${JSON.stringify(created)}`);
        }

        console.log('   Created student ID:', created.id);
        console.log('   Student created successfully (Unexpected if bug exists).');

        // Cleanup
        request('DELETE', `/students/${created.id}`);

    } catch (error) {
        console.error('❌ TEST FAILED (Expected):', error.message);
        // process.exit(1); // Don't exit with error, we want to confirm the failure
    }
}

runTests();
