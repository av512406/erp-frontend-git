
const { execSync } = require('child_process');

const BASE_URL = 'https://school.edulekha.in/api';
let TOKEN = '';

function request(method, path, data) {
    const url = `${BASE_URL}${path}`;
    let cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json"`;

    if (TOKEN) {
        cmd += ` -H "Authorization: Bearer ${TOKEN}"`;
    }

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

async function run() {
    try {
        console.log('Starting Session Switch Verification...');

        // 1. Login
        const loginRes = request('POST', '/login', { username: 'admin@demo.com', password: 'admin@demo.com' });
        if (!loginRes.token) throw new Error('Login failed');
        TOKEN = loginRes.token;
        console.log('Login successful.');

        // 2. Get Current Config
        const initialConfig = request('GET', '/school-config');
        const initialSession = initialConfig.session;
        console.log(`Initial Session: ${initialSession}`);

        // 3. Get Available Sessions
        const sessions = request('GET', '/sessions');
        if (!Array.isArray(sessions) || sessions.length < 2) {
            throw new Error('Not enough sessions to switch');
        }

        // Find a target session that is NOT the current one (by name or ID)
        // Since initialConfig.session is the NAME, we need to match by name.
        // Wait, initialConfig now returns "session" as the name.
        // Let's find a session with a different name.
        const targetSession = sessions.find(s => s.name !== initialSession);

        if (!targetSession) {
            // If all sessions have the same name (e.g. duplicates), pick one with a different ID?
            // But the UI displays names. If names are same, it's confusing.
            // Let's try to find one with a different ID first.
            // We don't have the current session ID in initialConfig, only name.
            // But we can infer it if names are unique.
            // If names are not unique, we might switch to same name but different ID.
            // Let's just pick the first one that is active? Or just the first one in the list?
            // Let's pick the first one that has a different ID than what we *think* is current.
            // Actually, we don't know the current ID.
            // Let's just pick index 0 if it's not the current name, or index 1.
            throw new Error('Could not find a different session to switch to (by name)');
        }

        console.log(`Switching to Session: ${targetSession.name} (${targetSession.id})`);

        // 4. Switch Session
        const switchRes = request('POST', '/schools/session', { sessionId: targetSession.id });
        if (switchRes.message && switchRes.message.includes('Failed')) {
            throw new Error(`Switch failed: ${JSON.stringify(switchRes)}`);
        }
        console.log('Switch API called successfully.');

        // 5. Verify Switch
        const newConfig = request('GET', '/school-config');
        console.log(`New Session: ${newConfig.session}`);

        if (newConfig.session !== targetSession.name) {
            throw new Error(`Session did not update! Expected ${targetSession.name}, got ${newConfig.session}`);
        }
        console.log('Session switch verified!');

        // 6. Switch Back (Cleanup)
        // We need to find the ID of the initial session.
        const initialSessionObj = sessions.find(s => s.name === initialSession);
        if (initialSessionObj) {
            console.log(`Switching back to: ${initialSessionObj.name} (${initialSessionObj.id})`);
            request('POST', '/schools/session', { sessionId: initialSessionObj.id });
            console.log('Switched back successfully.');
        } else {
            console.warn('Could not find initial session object to switch back to.');
        }

        console.log('✅ SESSION SWITCH VERIFIED');

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

run();
