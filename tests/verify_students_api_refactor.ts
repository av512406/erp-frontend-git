
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost/api';
const USERNAME = process.env.TEST_USERNAME || 'admin@sds.com';
const PASSWORD = process.env.TEST_PASSWORD || 'admin@sds.com';

let TOKEN = '';
let HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': ''
};

const LOG_PASS = (msg: string) => console.log(`  ✅ PASS: ${msg}`);
const LOG_FAIL = (msg: string) => console.error(`  ❌ FAIL: ${msg}`);
const LOG_INFO = (msg: string) => console.log(`  ℹ️  ${msg}`);

async function api(method: string, path: string, body?: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: HEADERS,
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: res.status, data, ok: res.ok };
}

async function runVerification() {
    try {
        console.log('Starting Student API Verification...');

        // 1. Auth
        const loginRes = await api('POST', '/login', { username: USERNAME, password: PASSWORD });
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
        TOKEN = loginRes.data.token;
        HEADERS['Authorization'] = `Bearer ${TOKEN}`;
        LOG_PASS('Logged in');

        // 2. Ensure Test Data
        // Create 3 students:
        // - Student A: Grade X, Section A, Name "Alpha"
        // - Student B: Grade X, Section B, Name "Beta"
        // - Student C: Grade Y, Section A, Name "Gamma"

        const timestamp = Date.now();
        const students = [
            { admissionNumber: `REF-A-${timestamp}`, name: `Alpha ${timestamp}`, grade: 'X', section: 'A' },
            { admissionNumber: `REF-B-${timestamp}`, name: `Beta ${timestamp}`, grade: 'X', section: 'B' },
            { admissionNumber: `REF-C-${timestamp}`, name: `Gamma ${timestamp}`, grade: 'Y', section: 'A' }
        ];

        // Fetch a valid session
        let sessionId;
        const sessionsRes = await api('GET', '/sessions');
        if (sessionsRes.ok && sessionsRes.data.length > 0) {
            sessionId = sessionsRes.data.find((s: any) => s.isActive)?.id || sessionsRes.data[0].id;
        } else {
            console.log('Creating new session...');
            const newSess = await api('POST', '/sessions', {
                name: `TEST-SESS-${Date.now()}`,
                startDate: '2025-04-01',
                endDate: '2026-03-31',
                is_active: true
            });
            if (!newSess.ok) throw new Error(`Failed to create session: ${JSON.stringify(newSess.data)}`);
            sessionId = newSess.data.id;
        }
        console.log(`Using Session ID: ${sessionId}`);

        for (const s of students) {
            const payload = {
                ...s,
                sessionId,
                dateOfBirth: '2010-01-01',
                admissionDate: '2025-01-01',
                mobileNumber: '9999999999',
                address: 'Test Addr',
                yearlyFeeAmount: "50000",
                transportFee: "0",
                aadharNumber: "123456789012",
                penNumber: "PEN12345",
                aaparId: "APAAR123"
            };
            const res = await api('POST', '/students', payload);
            if (!res.ok) {
                // Try to handle "Active academic session not set" if it occurs, similar to comprehensive test
                // But for simplicity assume environment is set up or just warn.
                if (res.data?.message?.includes('Active academic session')) {
                    // Try to fetch sessions to get a valid one?
                    // For now, fail hard so we know environment is wrong.
                    throw new Error(`Failed to create setup student: ${JSON.stringify(res.data)}`);
                }
                // Ignore if already exists (unlikely with timestamp)
                console.warn(`Could not create student ${s.admissionNumber}: ${JSON.stringify(res.data)}`);
            }
        }
        LOG_PASS('Test students created');

        // 3. Verify Filtering

        // 3.1 Grade Filter
        const resGrade = await api('GET', `/students?grade=X&sessionId=${sessionId}`);
        // We expect at least our 2 students (Alpha, Beta)
        // Since database might have other data, we just check if OUR students are there.
        const returnedGradeX = (Array.isArray(resGrade.data) ? resGrade.data : resGrade.data.data) || [];
        const foundAlpha = returnedGradeX.find((s: any) => s.admissionNumber === students[0].admissionNumber);
        const foundBeta = returnedGradeX.find((s: any) => s.admissionNumber === students[1].admissionNumber);
        const foundGamma = returnedGradeX.find((s: any) => s.admissionNumber === students[2].admissionNumber);

        assert.ok(foundAlpha, 'Grade X filter should contain Alpha');
        assert.ok(foundBeta, 'Grade X filter should contain Beta');
        assert.ok(!foundGamma, 'Grade X filter should NOT contain Gamma');
        LOG_PASS('Filter by Grade X works');

        // 3.2 Section Filter (Grade X + Section B)
        const resSec = await api('GET', `/students?grade=X&section=B&sessionId=${sessionId}`);
        const returnedSec = (Array.isArray(resSec.data) ? resSec.data : resSec.data.data) || [];
        const foundAlphaSec = returnedSec.find((s: any) => s.admissionNumber === students[0].admissionNumber);
        const foundBetaSec = returnedSec.find((s: any) => s.admissionNumber === students[1].admissionNumber);

        assert.ok(!foundAlphaSec, 'Section B filter should NOT contain Alpha (Section A)');
        assert.ok(foundBetaSec, 'Section B filter should contain Beta');
        LOG_PASS('Filter by Grade X + Section B works');

        // 3.3 Search (Query 'Gamma')
        const resSearch = await api('GET', `/students?q=Gamma ${timestamp}&sessionId=${sessionId}`);
        const returnedSearch = (Array.isArray(resSearch.data) ? resSearch.data : resSearch.data.data) || [];
        const foundGammaSearch = returnedSearch.find((s: any) => s.admissionNumber === students[2].admissionNumber);

        assert.ok(foundGammaSearch, 'Search for Gamma should return Gamma');
        assert.ok(returnedSearch.length === 1, `Search should be specific. Got ${returnedSearch.length} results`);
        LOG_PASS('Search filter works');

        // 3.4 Pagination
        // We need enough students for this. 
        // Let's just create 15 dummy students using a loop if needed, but we rely on existing data?
        // Let's force page 1, limit 1.
        const resPage = await api('GET', `/students?grade=X&limit=1&page=1&sessionId=${sessionId}`);
        assert.ok(resPage.data.meta, 'Pagination mode should return meta object');
        assert.equal(resPage.data.data.length, 1, 'Pagination limit 1 should return 1 record');

        LOG_PASS('Pagination structure works');


        LOG_PASS('Pagination structure works');

        // 3.5 PUT /students/:admissionNumber
        const alphaAdm = students[0].admissionNumber;
        const updatePayload = {
            name: "Alpha Updated",
            // We must provide at least one field.
            // Also need sessionId to be safe if update logic needs it ??
            // The legacy update logic uses sessionId if provided to update session details.
            // Let's passed sessionId to keep context.
            sessionId: sessionId
        };
        const resUpdate = await api('PUT', `/students/${alphaAdm}`, updatePayload);
        assert.ok(resUpdate.ok, `PUT /students/${alphaAdm} failed: ${JSON.stringify(resUpdate.data)}`);
        assert.equal(resUpdate.data.name, "Alpha Updated", "Update should reflect in response");

        // Verify with GET
        const resGetUpdate = await api('GET', `/students?q=Alpha Updated&sessionId=${sessionId}`);
        const foundUpdated = (resGetUpdate.data.data || resGetUpdate.data).find((s: any) => s.admissionNumber === alphaAdm);
        assert.ok(foundUpdated, 'Updated student should be found');
        assert.equal(foundUpdated.name, "Alpha Updated", "GET should return updated name");



        LOG_PASS('PUT /students/:admissionNumber works');

        // 3.6 DELETE /students/:id
        // Use Beta's ID
        const betaId = foundBeta.id;
        const resDel = await api('DELETE', `/students/${betaId}`);
        assert.ok(resDel.ok, 'DELETE /students/:id should succeed');

        // Verify it's gone
        const resGetDel = await api('GET', `/students?q=Beta&sessionId=${sessionId}`);
        const foundBetaAgain = (resGetDel.data.data || resGetDel.data).find((s: any) => s.id === betaId);
        assert.ok(!foundBetaAgain, 'Beta should be deleted');

        LOG_PASS('DELETE /students/:id works');

        console.log('✅ ALL VERIFICATIONS PASSED');

    } catch (e: any) {
        LOG_FAIL(e.message);
        process.exit(1);
    }
}

runVerification();
