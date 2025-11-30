
async function verifyLogin() {
    const users = [
        { username: 'superadmin@admin.com', password: 'superadmin123' },
        { username: 'admin@school.edu', password: 'admin123' }
    ];

    for (const user of users) {
        console.log(`Attempting login for ${user.username}...`);
        try {
            const res = await fetch('http://localhost/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });

            console.log(`Status: ${res.status}`);
            const body = await res.json();
            console.log('Response:', body);
        } catch (err) {
            console.error('Error:', err.message);
        }
        console.log('---');
    }
}

verifyLogin();
