import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { randomUUID } from 'crypto';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureTables(retries = 20, delayMs = 2000) {
  // Attempt connection with simple retry to handle 57P03 (database starting up)
  let client;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      client = await pool.connect();
      break;
    } catch (e: any) {
      if (attempt === retries || e?.code !== '57P03') throw e;
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1))); // linear backoff
    }
  }
  if (!client) throw new Error('Could not obtain DB connection');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_sessions (
        id text PRIMARY KEY,
        name text NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        is_active boolean DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS schools (
        id text PRIMARY KEY,
        name text NOT NULL,
        slug text UNIQUE NOT NULL,
        address text,
        phone text,
        logo_url text,
        exam_pattern jsonb,
        is_active boolean DEFAULT true,
        current_session_id text REFERENCES academic_sessions(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

      CREATE TABLE IF NOT EXISTS students (
        id text PRIMARY KEY,
        admission_number text NOT NULL,
        name text NOT NULL,
        date_of_birth date NOT NULL,
        admission_date date NOT NULL,
        aadhar_number text,
        pen_number text,
        aapar_id text,
        mobile_number text,
        address text,
        grade text,
        section text,
        father_name text,
        mother_name text,
        yearly_fee_amount numeric(10,2) NOT NULL,
        previous_year_due numeric(10,2) DEFAULT 0,
        status text NOT NULL DEFAULT 'active',
        left_date date,
        leaving_reason text,
        gender text,
        school_id text REFERENCES schools(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(school_id, admission_number)
      );

      CREATE TABLE IF NOT EXISTS fee_transactions (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        transaction_id text UNIQUE NOT NULL,
        amount numeric(10,2) NOT NULL,
        payment_date date NOT NULL,
        payment_mode text,
        remarks text,
        receipt_serial integer,
        school_id text REFERENCES schools(id),
        session_id text REFERENCES academic_sessions(id),
        status text NOT NULL DEFAULT 'active',
        cancel_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(school_id, receipt_serial)
      );

      CREATE TABLE IF NOT EXISTS grades (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject text NOT NULL,
        marks numeric(5,2) NOT NULL,
        term text NOT NULL,
        school_id text REFERENCES schools(id),
        session_id text REFERENCES academic_sessions(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      
      CREATE TABLE IF NOT EXISTS teachers (
        id text PRIMARY KEY,
        name text NOT NULL,
        date_of_joining date NOT NULL,
        salary numeric(10,2) NOT NULL,
        address text,
        mobile_number text,
        qualification text,
        school_id text REFERENCES schools(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- subjects catalog
      CREATE TABLE IF NOT EXISTS subjects (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        school_id text REFERENCES schools(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(school_id, code)
      );

      -- per-class subject assignments
      CREATE TABLE IF NOT EXISTS class_subjects (
        id text PRIMARY KEY,
        grade text NOT NULL,
        subject_id text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        max_marks numeric(6,2),
        school_id text REFERENCES schools(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(grade, subject_id)
      );

      CREATE TABLE IF NOT EXISTS student_sessions (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        session_id text NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
        grade text NOT NULL,
        section text NOT NULL,
        roll_number text,
        status text NOT NULL DEFAULT 'active',
        school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        UNIQUE(student_id, session_id)
      );

      -- add transaction_id column if upgrading existing schema
      ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS transaction_id text UNIQUE;
  -- ensure timestamp columns exist for legacy tables
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text;
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  -- ensure columns exist for new tables in case of partial deployments
  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS max_marks numeric(6,2);
  
  -- Add school_id to all tables
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
  ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
  
  -- Add session_id to tables
  ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_session_id text REFERENCES academic_sessions(id);
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS session_id text REFERENCES academic_sessions(id);
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS session_id text REFERENCES academic_sessions(id);
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS session_id text REFERENCES academic_sessions(id);
  ALTER TABLE schools ADD COLUMN IF NOT EXISTS exam_pattern jsonb;

      -- backfill any null transaction_id values
      UPDATE fee_transactions SET transaction_id = concat('TXN', substr(md5(random()::text),1,8)) WHERE transaction_id IS NULL;
      -- add parent name columns if missing
      ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name text;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name text;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
  ALTER TABLE students ADD COLUMN IF NOT EXISTS left_date date;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_reason text;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS category text DEFAULT 'GEN';
  ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
  ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_year_due numeric(10,2) DEFAULT 0;

      -- ensure payment_mode cannot be null and has a sensible default
      ALTER TABLE fee_transactions ALTER COLUMN payment_mode SET DEFAULT 'cash';
      UPDATE fee_transactions SET payment_mode = 'cash' WHERE payment_mode IS NULL;
      ALTER TABLE fee_transactions ALTER COLUMN payment_mode SET NOT NULL;

      -- ensure positive amount
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fee_amount_positive' AND table_name = 'fee_transactions'
        ) THEN
          ALTER TABLE fee_transactions ADD CONSTRAINT fee_amount_positive CHECK (amount > 0);
        END IF;
      END $$;

      -- Receipt Serial Migration
      -- 1. Add column
      ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS receipt_serial integer;

      -- 2. Create sequence
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_serial_seq') THEN
          CREATE SEQUENCE receipt_serial_seq OWNED BY fee_transactions.receipt_serial;
        END IF;
      END $$;

      -- 3. Backfill null serials (safe for partial runs)
      WITH ordered AS (
        SELECT id,
               COALESCE((SELECT MAX(receipt_serial) FROM fee_transactions), 0) + 
               ROW_NUMBER() OVER (ORDER BY payment_date, created_at) AS rn
        FROM fee_transactions
        WHERE receipt_serial IS NULL
      )
      UPDATE fee_transactions f
      SET receipt_serial = ordered.rn
      FROM ordered
      WHERE f.id = ordered.id;

      -- 4. Set default
      ALTER TABLE fee_transactions ALTER COLUMN receipt_serial SET DEFAULT nextval('receipt_serial_seq');

      -- 5. Sync sequence safely
      SELECT setval('receipt_serial_seq', COALESCE((SELECT MAX(receipt_serial) FROM fee_transactions), 1), (SELECT MAX(receipt_serial) FROM fee_transactions) IS NOT NULL);

      -- helpful index for frequent queries
      CREATE INDEX IF NOT EXISTS idx_fee_transactions_student_date ON fee_transactions (student_id, payment_date);

      -- limit payment_mode to known set
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fee_payment_mode_allowed' AND table_name = 'fee_transactions'
        ) THEN
          ALTER TABLE fee_transactions ADD CONSTRAINT fee_payment_mode_allowed CHECK (payment_mode IN ('cash','card','upi','cheque','bank-transfer','other'));
        END IF;
      END $$;

      -- indexes for students filters and search
      CREATE INDEX IF NOT EXISTS idx_students_grade_section ON students (grade, section);
      CREATE INDEX IF NOT EXISTS idx_students_name ON students (name);

      -- unique grade entries per (student, subject, term)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'uniq_grade_student_subject_term' AND table_name = 'grades'
        ) THEN
          ALTER TABLE grades ADD CONSTRAINT uniq_grade_student_subject_term UNIQUE (student_id, subject, term);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_grades_student_term ON grades (student_id, term);

      -- trigger to auto-update updated_at on row updates
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'fee_transactions_set_updated_at'
        ) THEN
          CREATE TRIGGER fee_transactions_set_updated_at
          BEFORE UPDATE ON fee_transactions
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'students_set_updated_at'
        ) THEN
          CREATE TRIGGER students_set_updated_at
          BEFORE UPDATE ON students
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'grades_set_updated_at'
        ) THEN
          CREATE TRIGGER grades_set_updated_at
          BEFORE UPDATE ON grades
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;

      -- Users table for authentication
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        username text UNIQUE NOT NULL,
        password text NOT NULL,
        role text NOT NULL DEFAULT 'teacher',
        name text NOT NULL DEFAULT 'User',
        school_id text REFERENCES schools(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Ensure columns exist if table already existed (robust migration)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'User';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      
      -- Ensure unique constraint on username exists for ON CONFLICT to work
      DO $$
      BEGIN
        -- Handle legacy email column if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
          -- Make email nullable to avoid insert errors if we only use username
          ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
          -- Backfill username from email if missing
          UPDATE users SET username = email WHERE username IS NULL;
        END IF;

        -- Handle legacy password_hash column if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
        ) THEN
          -- Check if any unique constraint exists on username to avoid duplicate
          IF NOT EXISTS (
            SELECT 1 FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'users'::regclass AND a.attname = 'username' AND i.indisunique
          ) THEN
             ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
          END IF;
        END IF;
      END $$;

      -- MIGRATION: Fix Student Import Across Schools
      -- Drop global unique constraint on admission_number and add composite unique constraint
      DO $$
      BEGIN
        -- 1. Drop old constraint if exists
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'students_admission_number_key'
        ) THEN
          ALTER TABLE students DROP CONSTRAINT students_admission_number_key;
        END IF;

        -- 2. Add new composite constraint if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'students_school_id_admission_number_key'
        ) THEN
          -- Ensure school_id is not null for existing records before adding constraint (optional safety)
          -- DELETE FROM students WHERE school_id IS NULL; -- Or handle appropriately
          
          ALTER TABLE students ADD CONSTRAINT students_school_id_admission_number_key UNIQUE (school_id, admission_number);
        END IF;
      END $$;

      -- MIGRATION: Fix Subject Code Across Schools
      -- Drop global unique constraint on code and add composite unique constraint
      DO $$
      BEGIN
        -- 1. Drop old constraint if exists
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'subjects_code_key'
        ) THEN
          ALTER TABLE subjects DROP CONSTRAINT subjects_code_key;
        END IF;

        -- 2. Add new composite constraint if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'subjects_school_id_code_key'
        ) THEN
          ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_code_key UNIQUE (school_id, code);
        END IF;
      END $$;

      -- MIGRATION: Fix Receipt Serial Uniqueness
      -- Add composite unique constraint on (school_id, receipt_serial)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_school_id_receipt_serial_key'
        ) THEN
          -- Note: This might fail if duplicates exist. User should clean data or we accept failure in dev.
          -- In production, we'd need a cleanup strategy.
          ALTER TABLE fee_transactions ADD CONSTRAINT fee_transactions_school_id_receipt_serial_key UNIQUE (school_id, receipt_serial);
        END IF;
      END $$;

      -- MIGRATION: Add status and cancel_reason to fee_transactions
      ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
      ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS cancel_reason text;

    `);

    // --- Session Management Migration ---
    await client.query(`
      -- Backfill Data Strategy
      DO $$
      DECLARE
        default_session_id text;
      BEGIN
        -- 1. Create Default Session '2025-2026' if no sessions exist
        IF NOT EXISTS (SELECT 1 FROM academic_sessions) THEN
          default_session_id := gen_random_uuid()::text;
          INSERT INTO academic_sessions (id, name, start_date, end_date, is_active)
          VALUES (default_session_id, '2025-2026', '2025-04-01', '2026-03-31', true);
          
          -- 2. Link all schools to this session
          UPDATE schools SET current_session_id = default_session_id WHERE current_session_id IS NULL;

          -- 3. Link existing transactions to this session
          UPDATE fee_transactions SET session_id = default_session_id WHERE session_id IS NULL;

          -- 4. Link existing grades to this session
          UPDATE grades SET session_id = default_session_id WHERE session_id IS NULL;

          -- 5. Snapshot existing students into student_sessions
          INSERT INTO student_sessions (id, student_id, session_id, grade, section, status, school_id)
          SELECT 
            gen_random_uuid()::text,
            s.id,
            default_session_id,
            s.grade,
            s.section,
            s.status,
            s.school_id
          FROM students s
          WHERE NOT EXISTS (
            SELECT 1 FROM student_sessions ss WHERE ss.student_id = s.id AND ss.session_id = default_session_id
          );
        END IF;
      END $$;
    `);

    await seedDefaults(client);
  } finally {
    client.release();
  }
}

export async function seedDefaults(client: any) {
  // Seed Super Admin from Environment Variables
  const username = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn('Skipping Super Admin seeding: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set.');
    return;
  }

  await client.query(`
    INSERT INTO users (id, username, password, role, name)
    VALUES ('super-admin-id', $1, $2, 'superadmin', 'Super Admin')
    ON CONFLICT (username) DO UPDATE SET 
      password = EXCLUDED.password,
      role = 'superadmin';
  `, [username, password]);

  // We do NOT seed a default school anymore.
  // The super admin will create schools manually.
}

export function genId() {
  return randomUUID();
}

export function genTransactionId() {
  return 'TXN' + randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}

// optional helper to run ad-hoc SQL from file (not used here but handy)
export async function runSqlFileIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    }
  } catch (e) {
    // ignore
  }
}

export default pool;
