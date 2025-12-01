
import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import makeFetchCookie from 'fetch-cookie';

const BASE_URL = 'http://school.edulekha.in';
const jar = new CookieJar();
const fetchWithCookie = makeFetchCookie(fetch, jar);

const results = {};

function logResult(feature, status, details = '') {
    results[feature] = { status, details };
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${feature}: ${status} ${details ? `(${details})` : ''}`);
}

async function request(method, path, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetchWithCookie(`${BASE_URL}${path}`, opts);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch (e) { }
        return { status: res.status, body: json || text, headers: res.headers };
    } catch (e) {
        return { status: 0, error: e.message };
    }
}

async function run() {
    console.log('🚀 Starting Master Verification...');

    // --- 1. Auth & Setup ---
    let res = await request('POST', '/api/login', { username: 'av512406@school.com', password: 'Anand@8520#' });
    if (res.status === 200) logResult('SuperAdmin Login', 'PASS');
    else { logResult('SuperAdmin Login', 'FAIL', res.body); return; }

    // Create Test School
    const slug = `master-${Date.now()}`;
    res = await request('POST', '/api/schools', {
        name: 'Master Test School', slug, address: 'Test Addr', phone: '1234567890'
    });
    if (res.status === 201) logResult('Create School', 'PASS');
    else { logResult('Create School', 'FAIL', res.body); return; }
    const schoolId = res.body.school.id;

    // Login as School Admin
    await request('POST', '/api/logout');
    res = await request('POST', '/api/login', { username: `admin@${slug}.com`, password: `${slug}123` });
    if (res.status === 200) logResult('SchoolAdmin Login', 'PASS');
    else { logResult('SchoolAdmin Login', 'FAIL', res.body); return; }

    // Verify /api/me
    res = await request('GET', '/api/me');
    if (res.status === 200 && res.body.user) logResult('Get Me', 'PASS');
    else logResult('Get Me', 'FAIL');

    // --- 2. Users ---
    // Create a Teacher
    const teacherUsername = `teacher-${Date.now()}`;
    res = await request('POST', '/api/users', {
        username: teacherUsername, password: 'password123', role: 'teacher', name: 'Test Teacher'
    });
    if (res.status === 201) logResult('Create User (Teacher)', 'PASS');
    else logResult('Create User (Teacher)', 'FAIL', res.body);
    const teacherId = res.body.id;

    // List Users
    res = await request('GET', '/api/users');
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Users', 'PASS');
    else logResult('List Users', 'FAIL');

    // --- 3. Students ---
    // Create Student
    res = await request('POST', '/api/students', {
        admissionNumber: `MST-${Date.now()}`, name: 'Master Student', dateOfBirth: '2015-01-01',
        admissionDate: '2025-04-01', yearlyFeeAmount: '15000', grade: '1', section: 'A',
        gender: 'Male', aadharNumber: '111122223333', penNumber: 'P1', aaparId: 'A1',
        mobileNumber: '9999999999', address: 'Addr'
    });
    if (res.status === 201) logResult('Create Student', 'PASS');
    else logResult('Create Student', 'FAIL', res.body);
    const studentId = res.body.id;
    const admissionNumber = res.body.admissionNumber;

    // Update Student
    res = await request('PUT', `/api/students/${admissionNumber}`, { name: 'Updated Student' });
    if (res.status === 200 && res.body.name === 'Updated Student') logResult('Update Student', 'PASS');
    else logResult('Update Student', 'FAIL');

    // List Students
    res = await request('GET', '/api/students');
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Students', 'PASS');
    else logResult('List Students', 'FAIL');

    // Withdraw Student
    res = await request('PUT', `/api/students/${admissionNumber}/withdraw`, { date: '2025-06-01', reason: 'Test' });
    if (res.status === 200) logResult('Withdraw Student', 'PASS');
    else logResult('Withdraw Student', 'FAIL');

    // List Withdrawn
    res = await request('GET', '/api/students/withdrawn');
    if (res.status === 200 && res.body.length > 0) logResult('List Withdrawn', 'PASS');
    else logResult('List Withdrawn', 'FAIL');

    // Restore Student
    res = await request('PUT', `/api/students/${admissionNumber}/restore`);
    if (res.status === 200) logResult('Restore Student', 'PASS');
    else logResult('Restore Student', 'FAIL');

    // --- 4. Fees ---
    // Collect Fee
    res = await request('POST', '/api/fees', {
        studentId, amount: '1000', paymentDate: '2025-05-01', paymentMode: 'cash', remarks: 'Test Fee'
    });
    if (res.status === 201) logResult('Collect Fee', 'PASS');
    else logResult('Collect Fee', 'FAIL', res.body);
    const feeId = res.body.id;

    // List Fees
    res = await request('GET', '/api/fees');
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Fees', 'PASS');
    else logResult('List Fees', 'FAIL');

    // Export Fees
    res = await request('GET', '/api/export/transactions/excel');
    if (res.status === 200) logResult('Export Fees (Excel)', 'PASS');
    else logResult('Export Fees (Excel)', 'FAIL');

    // --- 5. Subjects & Classes ---
    // Create Subject
    res = await request('POST', '/api/subjects', { code: 'ENG', name: 'English' });
    if (res.status === 201) logResult('Create Subject', 'PASS');
    else logResult('Create Subject', 'FAIL', res.body);
    const subjectId = res.body.id;

    // Assign Subject to Class
    // Route: app.post('/api/classes/:grade/subjects', ...)
    // Body: { subjectId, maxMarks, weeklyClasses, ... }
    res = await request('POST', `/api/classes/1/subjects`, { subjectId, maxMarks: 100 });
    if (res.status === 201 || res.status === 200) logResult('Assign Subject', 'PASS');
    else logResult('Assign Subject', 'FAIL', res.body);

    // List Class Subjects
    res = await request('GET', `/api/classes/1/subjects`);
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Class Subjects', 'PASS');
    else logResult('List Class Subjects', 'FAIL');

    // --- 6. Grades ---
    // Add Grade
    // Route: app.post('/api/grades', ...)
    // Body: [{ studentId, subject, marks, term, ... }]
    res = await request('POST', '/api/grades', [
        { studentId, subject: 'English', marks: 85, term: 'Term 1' }
    ]);
    if (res.status === 201 || res.status === 200) logResult('Add Grade', 'PASS');
    else logResult('Add Grade', 'FAIL', res.body);

    // List Grades
    res = await request('GET', '/api/grades');
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Grades', 'PASS');
    else logResult('List Grades', 'FAIL');

    // --- 7. Teachers (Endpoint) ---
    // Note: /api/teachers might just list users with role teacher or be a separate table.
    // Based on routes, it seems to exist.
    res = await request('GET', '/api/teachers');
    if (res.status === 200) logResult('List Teachers', 'PASS');
    else logResult('List Teachers', 'FAIL');

    // --- 8. Config & Templates ---
    // Get Config
    res = await request('GET', '/api/admin/config');
    if (res.status === 200) logResult('Get Config', 'PASS');
    else logResult('Get Config', 'FAIL');

    // Update Config
    res = await request('POST', '/api/admin/config', {
        name: 'Updated School Name', addressLine: 'New Addr', session: '2025-2026'
    });
    if (res.status === 200 && res.body.name === 'Updated School Name') logResult('Update Config', 'PASS');
    else logResult('Update Config', 'FAIL', res.body);

    // --- 9. Session Management (New) ---
    // Switch back to Super Admin
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: 'av512406@school.com', password: 'Anand@8520#' });

    // Create Session
    res = await request('POST', '/api/sessions', {
        name: '2027-2028', startDate: '2027-04-01', endDate: '2028-03-31', isActive: true
    });
    if (res.status === 201) logResult('Create Session', 'PASS');
    else logResult('Create Session', 'FAIL', res.body);
    const sessionId = res.body.id;

    // List Sessions
    res = await request('GET', '/api/sessions');
    if (res.status === 200 && Array.isArray(res.body)) logResult('List Sessions', 'PASS');
    else logResult('List Sessions', 'FAIL');

    // Switch Session (as School Admin)
    await request('POST', '/api/logout');
    await request('POST', '/api/login', { username: `admin@${slug}.com`, password: `${slug}123` });

    res = await request('POST', '/api/schools/session', { sessionId });
    if (res.status === 200) logResult('Switch Session', 'PASS');
    else logResult('Switch Session', 'FAIL', res.body);

    console.log('\n--- Final Master Report ---');
    console.table(results);
}

run();
