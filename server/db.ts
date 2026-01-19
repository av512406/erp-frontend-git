import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import * as schema from '@shared/schema';
import ws from 'ws';
import { randomUUID } from 'crypto';

neonConfig.webSocketConstructor = ws;

// Fallback for local development if not using Neon
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required.");
}
const DATABASE_URL = process.env.DATABASE_URL;

export let pool: any;
export let db: any;

if (DATABASE_URL.includes('neon.tech')) {
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  pool = new PgPool({ connectionString: DATABASE_URL });
  db = drizzlePg(pool, { schema });
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
      await migrate(db, { migrationsFolder: 'migrations' });
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

async function seedDefaults() {
  const username = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn('Skipping Super Admin seeding: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set.');
    return;
  }

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
        `, [username, password]);
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
