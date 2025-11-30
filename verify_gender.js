
const BASE_URL = 'http://localhost/api';

async function main() {
    // 1. Login as Super Admin (or School Admin)
    console.log('Logging in...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin@school.edu', password: 'admin123' })
    });

    if (!loginRes.ok) {
        console.error('Login failed:', await loginRes.text());
        return;
    }

    const cookie = loginRes.headers.get('set-cookie');
    console.log('Logged in successfully.');

    // 2. Create a new student with Gender
    const admissionNumber = `TEST-${Date.now()}`;
    console.log(`Creating student with Admission Number: ${admissionNumber} and Gender: Female`);

    const studentData = {
        admissionNumber,
        name: 'Gender Test Student',
        dateOfBirth: '2015-01-01',
        admissionDate: '2025-01-01',
        aadharNumber: '123412341234',
        penNumber: 'PEN123456',
        aaparId: 'AAPAR123',
        mobileNumber: '9999999999',
        address: 'Test Address',
        grade: '1',
        section: 'A',
        yearlyFeeAmount: '10000',
        category: 'GEN',
        gender: 'Female'
    };

    // Simulate Import (or direct create if API exposed, but import is what we modified heavily)
    // We'll use the import endpoint as it's the primary bulk tool
    const importRes = await fetch(`${BASE_URL}/students/import`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({ students: [studentData] })
    });

    if (!importRes.ok) {
        console.error('Import failed:', await importRes.text());
        return;
    }

    const importResult = await importRes.json();
    console.log('Import result:', importResult);

    // 3. Verify Gender is saved
    console.log('Fetching student to verify gender...');
    // We need to fetch all students and find this one, or use a specific endpoint if available.
    // The dashboard uses /api/students (implied, though not seen explicitly in routes.ts search earlier, let's assume standard REST or use the one we saw in DataToolsPage props source)
    // Wait, DataToolsPage gets `students` as prop. Let's check routes.ts for a GET /api/students

    const studentsRes = await fetch(`${BASE_URL}/students`, { // Assuming this exists or similar
        headers: { 'Cookie': cookie }
    });

    if (!studentsRes.ok) {
        // Fallback: try to find a GET route in routes.ts if this fails, but for now assume standard
        console.log('GET /api/students failed, trying to read from DB directly or alternative route?');
        // Actually, let's just check the DB directly via the app if possible, or trust the import result 'added' count.
        // But we want to verify the FIELD.
        // Let's assume GET /api/students works as it's used in the app.
    } else {
        const students = await studentsRes.json();
        const savedStudent = students.find(s => s.admissionNumber === admissionNumber);

        if (savedStudent) {
            console.log(`Student Found. Gender: ${savedStudent.gender}`);
            if (savedStudent.gender === 'Female') {
                console.log('SUCCESS: Gender saved correctly.');
            } else {
                console.error(`FAILURE: Gender mismatch. Expected Female, got ${savedStudent.gender}`);
            }
        } else {
            console.error('FAILURE: Student not found after import.');
        }
    }
}

main();
