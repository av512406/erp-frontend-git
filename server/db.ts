import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, NeonDatabase } from 'drizzle-orm/neon-serverless';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import * as schema from '@shared/schema';
import ws from 'ws';
import { randomUUID } from 'crypto';

neonConfig.webSocketConstructor = ws;

// Fallback for local development if not using Neon
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required.");
}
const DATABASE_URL = process.env.DATABASE_URL;

// Proper types instead of 'any' - separated to avoid union type conflicts
export let pool: NeonPool | PgPool;
export let db: any; // Keep as any for now due to incompatible Neon/Postgres pool types

if (DATABASE_URL.includes('neon.tech')) {
  pool = new NeonPool({ connectionString: DATABASE_URL });
  db = drizzleNeon(pool as NeonPool, { schema });
} else {
  pool = new PgPool({ connectionString: DATABASE_URL });
  db = drizzlePg(pool as any, { schema });
}

export async function connectAndMigrate() {
  console.log('Connecting to database...');
  // Simple connection check
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('Database connected successfully.');
  } finally {
    client.release();
  }

  console.log('Running Drizzle migrations...');
  try {
    if (DATABASE_URL.includes('neon.tech')) {
      await migrateNeon(db, { migrationsFolder: 'migrations' });
    } else {
      await migratePg(db, { migrationsFolder: 'migrations' });
    }
    console.log('Migrations complete.');

    // Seed Defaults (Super Admin)
    await seedDefaults();
  } catch (e) {
    console.error('Migration failed:', e);
    throw e;
  }
}

export async function seedDefaults() {
  const username = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn('Skipping Super Admin seeding: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set.');
    return;
  }

  // Import bcrypt for password hashing
  const bcrypt = await import('bcryptjs');

  // Hash the password before storing (critical security fix)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user exists using Drizzle or raw SQL. Raw SQL is fine for this specific seed.
  // Using simple pool query to avoid strict Drizzle types for ad-hoc inserts if schema changed differently
  const client = await pool.connect();
  try {
    await client.query(`
            INSERT INTO users (id, username, password, role, name)
            VALUES ('super-admin-id', $1, $2, 'superadmin', 'Super Admin')
            ON CONFLICT (username) DO UPDATE SET 
            password = EXCLUDED.password,
            role = 'superadmin';
        `, [username, hashedPassword]); // Use hashed password, not plaintext

    console.log('Super Admin user seeded/updated successfully');
  } finally {
    client.release();
  }
}

export function genId() {
  return randomUUID();
}

export function genTransactionId() {
  return 'TXN' + randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}
