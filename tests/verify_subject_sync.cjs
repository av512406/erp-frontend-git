const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/school_erp_db',
});

const JWT_SECRET = process.env.JWT_SECRET || 'some_super_secret_key_123';

async function verifySubjectSync() {
    const client = await pool.connect();
    try {
        console.log('Starting Subject Sync Verification...');

        // 1. Login as admin
        const loginRes = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin@demo.com', password: 'admin@demo.com' })
        });
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Login successful. Token obtained.');

        // 2. Create a test subject
        const subjectCode = `SYNC_TEST_${Date.now()}`;
        const subjectRes = await fetch('http://localhost:5000/api/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: 'Sync Test Subject', code: subjectCode })
        });
        if (!subjectRes.ok) throw new Error(`Failed to create subject: ${subjectRes.status}`);
        const subject = await subjectRes.json();
        console.log('Created test subject:', subject.name);

        // 2.5 Ensure Class 2 exists by adding a dummy student
        const studentRes = await fetch('http://localhost:5000/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                admissionNumber: `SYNC_STU_${Date.now()}`,
                name: 'Sync Test Student',
                dateOfBirth: '2015-01-01',
                admissionDate: '2025-01-01',
                aadharNumber: '123412341234',
                penNumber: 'PEN123',
                aaparId: 'AAPAR123',
                mobileNumber: '9999999999',
                address: 'Test Address',
                grade: '2',
                section: 'A',
                yearlyFeeAmount: '10000',
                gender: 'Male'
            })
        });
        // If student creation fails (e.g. duplicate), we ignore it as long as Class 2 exists.
        // But for clean test, we use unique admission number.
        if (!studentRes.ok) console.warn(`Warning: Failed to create student for Class 2: ${studentRes.status}`);
        else console.log('Created student in Class 2 to ensure grade existence.');

        // 3. Assign to Class 1
        const assignRes = await fetch('http://localhost:5000/api/classes/1/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ subjectId: subject.id })
        });
        if (!assignRes.ok) throw new Error(`Failed to assign subject: ${assignRes.status}`);
        console.log('Assigned subject to Class 1.');

        // 4. Trigger Sync to All Classes
        const syncRes = await fetch('http://localhost:5000/api/classes/1/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (!syncRes.ok) throw new Error(`Failed to sync subjects: ${syncRes.status}`);
        const syncResult = await syncRes.json();
        console.log('Sync triggered. Result:', syncResult);

        // 5. Verify assignment in Class 2
        const class2Res = await fetch('http://localhost:5000/api/classes/2/subjects', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!class2Res.ok) throw new Error(`Failed to fetch Class 2 subjects: ${class2Res.status}`);
        const class2Subjects = await class2Res.json();
        const found = class2Subjects.find(s => s.id === subject.id);

        if (found) {
            console.log('SUCCESS: Subject found in Class 2.');
        } else {
            console.error('FAILURE: Subject NOT found in Class 2.');
            console.log('Class 2 Subjects:', class2Subjects.map(s => s.name));
        }

        // Cleanup
        await client.query('DELETE FROM class_subjects WHERE subject_id = $1', [subject.id]);
        await client.query('DELETE FROM subjects WHERE id = $1', [subject.id]);
        console.log('Cleanup complete.');

    } catch (e) {
        console.error('Verification Failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifySubjectSync();
