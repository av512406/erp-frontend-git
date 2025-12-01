
import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import makeFetchCookie from 'fetch-cookie';

const BASE_URL = 'http://school.edulekha.in';
const jar = new CookieJar();
const fetchWithCookie = makeFetchCookie(fetch, jar);

const report = {
    login: 'PENDING',
    createSchool: 'PENDING',
    schoolLogin: 'PENDING',
    createStudent: 'PENDING',
    collectFee: 'PENDING',
};

async function run() {
    console.log('🚀 Starting Verification...');

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

    // 2. Create School
    const slug = `verify-${Date.now()}`;
    try {
        console.log(`Testing Create School (slug: ${slug})...`);
        const res = await fetchWithCookie(`${BASE_URL}/api/schools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Verification School',
                slug: slug,
                address: '123 Test Lane',
                phone: '1234567890',
                logoUrl: 'https://via.placeholder.com/150'
            })
        });
        if (res.status === 201) {
            report.createSchool = 'PASS';
            console.log('✅ Create School Passed');
        } else {
            report.createSchool = 'FAIL';
            console.error('❌ Create School Failed', await res.text());
            // Don't return, try to proceed if possible? No, need school for next steps.
            return;
        }
    } catch (e) {
        report.createSchool = 'FAIL';
        console.error('❌ Create School Error', e);
        return;
    }

    // 3. School Admin Login
    // First logout super admin
    await fetchWithCookie(`${BASE_URL}/api/logout`, { method: 'POST' });

    try {
        console.log('Testing School Admin Login...');
        const res = await fetchWithCookie(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `admin@${slug}.com`,
                password: `${slug}123`
            })
        });
        if (res.status === 200) {
            report.schoolLogin = 'PASS';
            console.log('✅ School Admin Login Passed');
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
        const res = await fetchWithCookie(`${BASE_URL}/api/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        });
        if (res.status === 201) {
            const data = await res.json();
            studentId = data.id;
            report.createStudent = 'PASS';
            console.log('✅ Create Student Passed');
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
    try {
        console.log('Testing Collect Fee...');
        const res = await fetchWithCookie(`${BASE_URL}/api/fees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: studentId,
                amount: '500',
                paymentDate: '2025-12-01',
                paymentMode: 'cash',
                remarks: 'Test Fee'
            })
        });
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

    console.log('\n--- Final Report ---');
    console.table(report);
}

run();
