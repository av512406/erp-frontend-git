
const BASE_URL = 'http://localhost/api';

async function main() {
    console.log('Verifying login with new credentials...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'av512406@school.com', password: 'Anand@8520#' })
    });

    if (!loginRes.ok) {
        console.error('Login failed:', await loginRes.text());
        process.exit(1);
    }

    const cookie = loginRes.headers.get('set-cookie');
    console.log('Set-Cookie:', cookie);
    console.log('Login successful!');

    // Verify role
    const meRes = await fetch(`${BASE_URL}/me`, {
        headers: { 'Cookie': cookie }
    });
    const me = await meRes.json();
    console.log('Response from /me:', JSON.stringify(me, null, 2));
    if (!me.user) {
        console.error('User object missing in /me response');
        process.exit(1);
    }
    console.log(`Logged in as: ${me.user.username} (Role: ${me.user.role})`);

    if (me.user.username === 'av512406@school.com' && me.user.role === 'superadmin') {
        console.log('SUCCESS: Credentials and role verified.');
    } else {
        console.error('FAILURE: Incorrect user details.');
        process.exit(1);
    }

    // Verify schools are empty
    console.log('Verifying schools list is empty...');
    const schoolsRes = await fetch(`${BASE_URL}/schools`, {
        headers: { 'Cookie': cookie }
    });
    const schools = await schoolsRes.json();
    console.log(`Schools found: ${schools.length}`);

    if (schools.length === 0) {
        console.log('SUCCESS: No schools found.');
    } else {
        console.error('FAILURE: Schools table is not empty.');
        process.exit(1);
    }
}

main();
