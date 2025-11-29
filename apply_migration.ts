import { ensureTables, pool } from './server/db';

async function main() {
    console.log('Running ensureTables...');
    try {
        await ensureTables();
        console.log('Tables ensured successfully.');
    } catch (e) {
        console.error('Error ensuring tables:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
