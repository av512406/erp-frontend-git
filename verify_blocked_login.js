
const BASE_URL = 'http://localhost/api';

async function main() {
    console.log('Attempting login with blocked school account...');
    const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin@school.edu', password: 'admin123' })
    });

    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Response Body:`, data);

    if (res.status === 403 && data.message === 'Your school account has been deactivated. Please contact support.') {
        console.log('SUCCESS: Correct error message received.');
    } else {
        console.error('FAILURE: Unexpected response.');
    }
}

main();
