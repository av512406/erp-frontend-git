
import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import makeFetchCookie from 'fetch-cookie';

const BASE_URL = 'http://school.edulekha.in';
const jar = new CookieJar();
const fetchWithCookie = makeFetchCookie(fetch, jar);

const report = {
    login: 'PENDING',
    studentImport: 'PENDING',
    transactionExport: 'PENDING',
    sessionCheck: 'PENDING',
};

async function run() {
    console.log('🚀 Starting Feature Verification...');

    // 1. Super Admin Login
    try {
        console.log('Testing Super Admin Login...');
        const res = await fetchWithCookie(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'av512406@school.com',
                password: 'Anand@8520#'
            })
        });
        if (res.status === 200) {
            report.login = 'PASS';
            console.log('✅ Super Admin Login Passed');
        } else {
            report.login = 'FAIL';
            console.error('❌ Super Admin Login Failed', await res.text());
            return;
        }
    } catch (e) {
        report.login = 'FAIL';
        console.error('❌ Super Admin Login Error', e);
        return;
    }

    // 2. Test Student Import
    try {
        console.log('Testing Student Import...');
        const importData = {
            students: [
                {
                    admissionNumber: `IMP-${Date.now()}`,
                    name: 'Imported Student',
                    dateOfBirth: '2012-01-01',
                    admissionDate: '2025-04-01',
                    yearlyFeeAmount: '12000',
                    grade: '5',
                    section: 'B',
                    gender: 'Female',
                    aadharNumber: '987654321098',
                    penNumber: 'PEN999',
                    aaparId: 'APAAR999',
                    mobileNumber: '9988776655',
                    address: 'Imported Address'
                }
            ],
            strategy: 'upsert'
        };

        const res = await fetchWithCookie(`${BASE_URL}/api/students/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importData)
        });

        if (res.status === 200) {
            const data = await res.json();
            if (data.added === 1 || data.updated === 1) {
                report.studentImport = 'PASS';
                console.log('✅ Student Import Passed');
            } else {
                report.studentImport = 'FAIL';
                console.error('❌ Student Import Failed (Count mismatch)', data);
            }
        } else {
            report.studentImport = 'FAIL';
            console.error('❌ Student Import Failed', await res.text());
        }
    } catch (e) {
        report.studentImport = 'FAIL';
        console.error('❌ Student Import Error', e);
    }

    // 3. Test Transaction Export
    try {
        console.log('Testing Transaction Export...');
        const res = await fetchWithCookie(`${BASE_URL}/api/export/transactions/excel`, {
            method: 'GET'
        });

        if (res.status === 200) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/vnd.ms-excel')) {
                report.transactionExport = 'PASS';
                console.log('✅ Transaction Export Passed');
            } else {
                report.transactionExport = 'FAIL';
                console.error('❌ Transaction Export Failed (Wrong Content-Type)', contentType);
            }
        } else {
            report.transactionExport = 'FAIL';
            console.error('❌ Transaction Export Failed', await res.text());
        }
    } catch (e) {
        report.transactionExport = 'FAIL';
        console.error('❌ Transaction Export Error', e);
    }

    // 4. Test Session Check
    try {
        console.log('Testing Session Check...');
        // Need to get school config. First ensure we are logged in as a school admin or super admin can access it?
        // Super admin login is already done. Let's see if super admin has a schoolId associated or if we need to switch.
        // The login response for super admin usually has a schoolId if they are also a school admin, but super admin might not.
        // However, the /api/admin/config endpoint uses `req.session.user.schoolId`.
        // Let's try to get config. If it fails (404/403), we might need to create a school and login as its admin.
        // But we already have a school from previous tests. Let's use the login from the previous script if needed, 
        // but for now let's try with super admin. 
        // Actually, super admin might not have a schoolId in session.
        // Let's create a temp school to be sure.

        const slug = `feat-test-${Date.now()}`;
        await fetchWithCookie(`${BASE_URL}/api/schools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Feature Test School',
                slug: slug,
                address: 'Test Address',
                phone: '1234567890',
                logoUrl: 'https://via.placeholder.com/150'
            })
        });

        // Login as the new school admin
        await fetchWithCookie(`${BASE_URL}/api/logout`, { method: 'POST' });
        const loginRes = await fetchWithCookie(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `admin@${slug}.com`,
                password: `${slug}123`
            })
        });

        if (loginRes.status === 200) {
            const res = await fetchWithCookie(`${BASE_URL}/api/admin/config`, {
                method: 'GET'
            });

            if (res.status === 200) {
                const data = await res.json();
                if (data.session === '2025-2026') {
                    report.sessionCheck = 'PASS';
                    console.log('✅ Session Check Passed (2025-2026)');
                } else {
                    report.sessionCheck = 'FAIL';
                    console.error('❌ Session Check Failed (Wrong Session)', data.session);
                }
            } else {
                report.sessionCheck = 'FAIL';
                console.error('❌ Session Check Failed (Config fetch)', await res.text());
            }
        } else {
            report.sessionCheck = 'FAIL';
            console.error('❌ Session Check Failed (School Login)', await loginRes.text());
        }

    } catch (e) {
        report.sessionCheck = 'FAIL';
        console.error('❌ Session Check Error', e);
    }

    console.log('\n--- Final Feature Report ---');
    console.table(report);
}

run();
