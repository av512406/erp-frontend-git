import { pool } from './server/db';

async function wipe() {
    console.log('Detailed Wipe: Dropping public schema...');
    try {
        await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
        await pool.query('CREATE SCHEMA public');
        console.log('Database wiped successfully (public schema recreated).');
    } catch (err) {
        console.error('Error wiping database:', err);
        process.exit(1);
    } finally {
        await pool.end(); // Close connection
    }
}

wipe();
