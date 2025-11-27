
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost/api';

function request(method, path, data) {
    const url = `${BASE_URL}${path}`;
    let cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json"`;

    if (data) {
        // Escape single quotes in JSON for shell
        const json = JSON.stringify(data).replace(/'/g, "'\\''");
        cmd += ` -d '${json}'`;
    }

    // console.log('Executing:', cmd);
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
    console.log('Starting Import/Export Round-trip Test...');

    const testStudent = {
        admissionNumber: "TEST_SUITE_001",
        name: "Test Suite Student",
        dateOfBirth: "2015-01-01",
        admissionDate: "2024-01-01",
        yearlyFeeAmount: "15000",
        status: "active",
        grade: "5",
        section: "B",
        aadharNumber: "999988887777",
        penNumber: "PEN999",
        aaparId: "APA999",
        mobileNumber: "9876543210",
        address: "Test Suite Address"
    };

    try {
        // 1. Create Student
        console.log('1. Creating test student...');
        const created = request('POST', '/students', testStudent);
        if (!created.id) {
            throw new Error(`Failed to create student: ${JSON.stringify(created)}`);
        }
        console.log('   Created student ID:', created.id);

        // 2. Export Students
        console.log('2. Exporting students...');
        const exportRes = request('GET', '/export/students');
        // exportRes will be a string (CSV)
        if (typeof exportRes !== 'string' || !exportRes.includes(testStudent.admissionNumber)) {
            throw new Error('Exported CSV does not contain the test student');
        }
        console.log('   Student found in export.');

        // 3. Delete Student
        console.log('3. Deleting test student...');
        request('DELETE', `/students/${created.id}`);
        console.log('   Student deleted.');

        // 4. Import Student
        console.log('4. Importing student from simulated CSV data...');
        const importPayload = {
            students: [
                {
                    ...testStudent,
                    status: undefined
                }
            ]
        };

        const importRes = request('POST', '/students/import', importPayload);
        console.log('   Import result:', importRes);
        if (importRes.added !== 1) {
            throw new Error(`Expected 1 added, got ${importRes.added}`);
        }

        // 5. Verify Student Exists
        console.log('5. Verifying student exists...');
        const students = request('GET', '/students');
        const found = students.find((s) => s.admissionNumber === testStudent.admissionNumber);
        if (!found) {
            throw new Error('Student not found after import');
        }
        console.log('   Student verified:', found.name);

        // 6. Cleanup
        console.log('6. Cleaning up...');
        request('DELETE', `/students/${found.id}`);
        console.log('   Cleanup complete.');

        console.log('✅ TEST PASSED');

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

runTests();
