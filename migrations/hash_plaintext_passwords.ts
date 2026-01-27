import { pool } from './server/db';
import bcrypt from 'bcryptjs';

/**
 * One-time migration script to hash all plaintext passwords in the database
 * Run this script once before deploying the fix that removes plaintext password support
 * 
 * Usage: tsx migrations/hash_plaintext_passwords.ts
 */

async function hashPlaintextPasswords() {
    console.log('Starting password migration...');

    try {
        // Find all users with plaintext passwords (not starting with bcrypt prefix)
        const result = await pool.query(`
      SELECT id, username, password 
      FROM users 
      WHERE password NOT LIKE '$2a$%' 
      AND password NOT LIKE '$2b$%'
    `);

        const users = result.rows;
        console.log(`Found ${users.length} users with plaintext passwords`);

        if (users.length === 0) {
            console.log('No plaintext passwords found. Migration not needed.');
            return;
        }

        // Hash each plaintext password
        let updated = 0;
        for (const user of users) {
            try {
                const hashedPassword = await bcrypt.hash(user.password, 10);

                await pool.query(
                    'UPDATE users SET password = $1 WHERE id = $2',
                    [hashedPassword, user.id]
                );

                console.log(`✓ Hashed password for user: ${user.username}`);
                updated++;
            } catch (err) {
                console.error(`✗ Failed to hash password for user ${user.username}:`, err);
            }
        }

        console.log(`\nMigration complete!`);
        console.log(`Successfully hashed ${updated} out of ${users.length} passwords`);

        if (updated < users.length) {
            console.warn(`WARNING: ${users.length - updated} passwords failed to hash. Please review errors above.`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the migration
hashPlaintextPasswords()
    .then(() => {
        console.log('Migration script finished successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration script failed:', err);
        process.exit(1);
    });
