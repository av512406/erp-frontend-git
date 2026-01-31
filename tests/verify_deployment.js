
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

const report = {
    login: 'PENDING',
    createSchool: 'PENDING',
    schoolLogin: 'PENDING',
    createStudent: 'PENDING',
    collectFee: 'PENDING',
};

// Helper for authenticated requests
async function fetchWithAuth(url, options = {}, token = null) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
}

async function run() {
    console.log('🚀 Starting Verification on localhost:5000...');

    let superAdminToken = null;
    let schoolAdminToken = null;

    // 1. Super Admin Login
    try {
        console.log('Testing Super Admin Login...');
        const res = await fetchWithAuth(`${BASE_URL}/api/login`, {
            method: 'POST',
            body: JSON.stringify({
                username: process.env.SUPER_ADMIN_EMAIL || 'av512406@school.com',
                password: process.env.SUPER_ADMIN_PASSWORD || 'Anand@8520#'
            })
        });
        if (res.status === 200) {
            const data = await res.json();
            superAdminToken = data.token;
            if (superAdminToken) {
                report.login = 'PASS';
                console.log('✅ Super Admin Login Passed');
            } else {
                console.error('❌ Login successful but no token returned');
                report.login = 'FAIL';
                return;
            }
        } else {
            console.error('❌ Super Admin Login Failed', res.status, await res.text());
            report.login = 'FAIL';
            return;
        }
    } catch (e) {
        report.login = 'FAIL';
        console.error('❌ Super Admin Login Error', e);
        return;
    }

    let currentSessionId = null;

    // 2. Create School
    const slug = `verify-${Date.now()}`;
    try {
        console.log(`Testing Create School (slug: ${slug})...`);
        const res = await fetchWithAuth(`${BASE_URL}/api/schools`, {
            method: 'POST',
            body: JSON.stringify({
                name: 'Verification School',
                slug: slug,
                address: '123 Test Lane',
                phone: '1234567890',
                logoUrl: 'https://via.placeholder.com/150'
            })
        }, superAdminToken);

        if (res.status === 201) {
            const data = await res.json();
            if (data.school && data.school.currentSessionId) {
                currentSessionId = data.school.currentSessionId;
            } else if (data.school && data.school.current_session_id) {
                currentSessionId = data.school.current_session_id;
            }
            report.createSchool = 'PASS';
            console.log('✅ Create School Passed');
        } else {
            report.createSchool = 'FAIL';
            console.error('❌ Create School Failed', await res.text());
            return;
        }
    } catch (e) {
        report.createSchool = 'FAIL';
        console.error('❌ Create School Error', e);
        return;
    }

    // 3. School Admin Login
    // Client-side logout is just dropping token.
    superAdminToken = null;

    try {
        console.log('Testing School Admin Login...');
        const res = await fetchWithAuth(`${BASE_URL}/api/login`, {
            method: 'POST',
            body: JSON.stringify({
                username: `admin@${slug}.com`,
                password: `${slug}123`
            })
        });
        if (res.status === 200) {
            const data = await res.json();
            schoolAdminToken = data.token;
            if (schoolAdminToken) {
                report.schoolLogin = 'PASS';
                console.log('✅ School Admin Login Passed');

                // Determine active session ID
                try {
                    const sessRes = await fetchWithAuth(`${BASE_URL}/api/sessions`, {}, schoolAdminToken);
                    if (sessRes.ok) {
                        const sessions = await sessRes.json();
                        const active = sessions.find(s => s.is_active || s.isActive) || sessions[0];
                        if (active) {
                            currentSessionId = active.id;
                            console.log('Using Session ID:', currentSessionId);
                        }
                    }
                } catch (e) {
                    console.log('Failed to fetch sessions, will attempt without explicitly setting session if possible (but we know it fails)');
                }

            } else {
                report.schoolLogin = 'FAIL';
                console.error('❌ School Admin Login successful but no token');
                return;
            }
        } else {
            report.schoolLogin = 'FAIL';
            console.error('❌ School Admin Login Failed', await res.text());
            return;
        }
    } catch (e) {
        report.schoolLogin = 'FAIL';
        console.error('❌ School Admin Login Error', e);
        return;
    }

    // 4. Create Student
    let studentId;
    try {
        console.log('Testing Create Student...');
        const res = await fetchWithAuth(`${BASE_URL}/api/students`, {
            method: 'POST',
            body: JSON.stringify({
                admissionNumber: `ADM-${Date.now()}`,
                name: 'Test Student',
                dateOfBirth: '2010-01-01',
                admissionDate: '2025-04-01',
                yearlyFeeAmount: '10000',
                grade: '1',
                section: 'A',
                gender: 'Male',
                aadharNumber: '123456789012',
                penNumber: 'PEN123',
                aaparId: 'APAAR123',
                mobileNumber: '9876543210',
                address: 'Test Address'
            })
        }, schoolAdminToken);

        if (res.status === 201) {
            const data = await res.json();
            studentId = data.id || data.data?.id; // backend might wrap response
            if (!studentId) {
                // Check logic
                // server/routes/students.ts usually returns created student
                console.log('Response:', data);
                studentId = data.id;
            }
            if (studentId) {
                report.createStudent = 'PASS';
                console.log('✅ Create Student Passed');
            } else {
                console.error('❌ Create Student responded 201 but no ID found');
                report.createStudent = 'FAIL';
            }
        } else {
            report.createStudent = 'FAIL';
            console.error('❌ Create Student Failed', await res.text());
            return;
        }
    } catch (e) {
        report.createStudent = 'FAIL';
        console.error('❌ Create Student Error', e);
        return;
    }

    // 5. Collect Fee
    if (studentId) {
        try {
            console.log('Testing Collect Fee...');
            const res = await fetchWithAuth(`${BASE_URL}/api/fees`, {
                method: 'POST',
                body: JSON.stringify({
                    studentId: studentId,
                    amount: '500',
                    paymentDate: '2025-12-01',
                    paymentMode: 'cash',
                    remarks: 'Test Fee',
                    id: `txn-${Date.now()}`, // Some APIs require ID or generate it? Assuming generate if missing or optional.
                    sessionId: currentSessionId
                })
            }, schoolAdminToken);

            if (res.status === 201) {
                report.collectFee = 'PASS';
                console.log('✅ Collect Fee Passed');
            } else {
                report.collectFee = 'FAIL';
                console.error('❌ Collect Fee Failed', await res.text());
            }
        } catch (e) {
            report.collectFee = 'FAIL';
            console.error('❌ Collect Fee Error', e);
        }
    }

    console.log('\n--- Final Report ---');
    console.table(report);
}

run();
