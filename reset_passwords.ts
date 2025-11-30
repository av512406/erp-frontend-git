
import { pool } from './server/db';
import { hashPassword } from './server/lib/auth';

async function resetPasswords() {
    try {
        console.log('Resetting passwords...');

        const superAdminPass = await hashPassword('superadmin123');
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [superAdminPass, 'superadmin@admin.com']);
        console.log('Superadmin password reset to: superadmin123');

        const adminPass = await hashPassword('admin123');
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [adminPass, 'admin@school.edu']);
        console.log('Admin password reset to: admin123');

    } catch (err) {
        console.error('Error resetting passwords:', err);
    } finally {
        await pool.end();
    }
}

resetPasswords();
