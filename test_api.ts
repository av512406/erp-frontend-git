

async function testApi() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:80/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin@demo.com', password: 'admin@demo.com' })
        });

        if (!loginRes.ok) {
            console.log('Login failed:', loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        console.log('Login data:', loginData);
        console.log('Login success. Token:', loginData.token ? 'Yes' : 'No');
        const token = loginData.token;

        // 2. Fetch Config
        const configRes = await fetch('http://localhost:80/api/school-config', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!configRes.ok) {
            console.log('Config fetch failed:', configRes.status, await configRes.text());
        } else {
            const config = await configRes.json();
            console.log('Config fetched:', config);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testApi();
