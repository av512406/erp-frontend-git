

const BASE_URL = 'http://localhost/api';

async function main() {
    // 1. Login as Super Admin
    console.log('Logging in as Super Admin...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'superadmin@admin.com', password: 'superadmin123' })
    });

    if (!loginRes.ok) {
        console.error('Login failed:', await loginRes.text());
        return;
    }

    // Get cookie
    const cookie = loginRes.headers.get('set-cookie');
    console.log('Logged in successfully.');

    // 2. Fetch Schools
    console.log('Fetching schools...');
    const schoolsRes = await fetch(`${BASE_URL}/schools`, {
        headers: { 'Cookie': cookie }
    });
    const schools = await schoolsRes.json();

    if (schools.length === 0) {
        console.log('No schools found.');
        return;
    }

    const school = schools[0];
    console.log(`Checking school: ${school.name} (ID: ${school.id})`);
    console.log(`Current Status (is_active): ${school.is_active}`);

    // 3. Toggle Status
    const newStatus = !school.is_active;
    console.log(`Toggling status to: ${newStatus}...`);

    const toggleRes = await fetch(`${BASE_URL}/schools/${school.id}/toggle-status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({ isActive: newStatus }) // Backend expects isActive
    });

    if (toggleRes.ok) {
        console.log('Toggle successful.');
    } else {
        console.error('Toggle failed:', await toggleRes.text());
        return;
    }

    // 4. Verify Status
    console.log('Verifying new status...');
    const verifyRes = await fetch(`${BASE_URL}/schools`, {
        headers: { 'Cookie': cookie }
    });
    const updatedSchools = await verifyRes.json();
    const updatedSchool = updatedSchools.find(s => s.id === school.id);

    console.log(`New Status (is_active): ${updatedSchool.is_active}`);

    if (updatedSchool.is_active === newStatus) {
        console.log('SUCCESS: Status updated correctly.');
    } else {
        console.error('FAILURE: Status did not update.');
    }
}

main();
