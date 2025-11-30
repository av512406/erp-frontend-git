import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://school_erp:school_erp_pass@localhost:15432/school_erp';

export const pool = new Pool({ connectionString: DATABASE_URL });

export async function ensureTables(retries = 8, delayMs = 1000) {
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
      CREATE TABLE IF NOT EXISTS students (
        id text PRIMARY KEY,
        admission_number text UNIQUE NOT NULL,
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
        status text NOT NULL DEFAULT 'active',
        left_date date,
        leaving_reason text,
        gender text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS fee_transactions (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        transaction_id text UNIQUE NOT NULL,
        amount numeric(10,2) NOT NULL,
        payment_date date NOT NULL,
        payment_mode text,
        remarks text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS grades (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject text NOT NULL,
        marks numeric(5,2) NOT NULL,
        term text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- subjects catalog
      CREATE TABLE IF NOT EXISTS subjects (
        id text PRIMARY KEY,
        code text UNIQUE NOT NULL,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- per-class subject assignments
      CREATE TABLE IF NOT EXISTS class_subjects (
        id text PRIMARY KEY,
        grade text NOT NULL,
        subject_id text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        max_marks numeric(6,2),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(grade, subject_id)
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
      -- backfill any null transaction_id values
      UPDATE fee_transactions SET transaction_id = concat('TXN', substr(md5(random()::text),1,8)) WHERE transaction_id IS NULL;
      -- add parent name columns if missing
      ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name text;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name text;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
  ALTER TABLE students ADD COLUMN IF NOT EXISTS left_date date;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_reason text;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS category text DEFAULT 'GEN';

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
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Ensure columns exist if table already existed (robust migration)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'User';
      
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

      -- Seed default admin if no users exist
      INSERT INTO users (id, username, password, role, name)
      VALUES ('admin-seed-id', 'admin@school.edu', 'admin123', 'admin', 'Administrator')
      ON CONFLICT (username) DO NOTHING;

      -- School configuration (Multi-tenant)
      CREATE TABLE IF NOT EXISTS schools (
        id text PRIMARY KEY,
        name text NOT NULL,
        slug text UNIQUE NOT NULL,
        address text,
        phone text,
        logo_url text,
        is_active boolean DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Seed default school if none exists
      INSERT INTO schools (id, name, slug, address, phone)
      VALUES ('default-school-id', 'GLORIOUS PUBLIC SCHOOL', 'glorious', 'Jamoura (Sarkhadi), Distt. LALITPUR (U.P)', '+91-0000-000000')
      ON CONFLICT (slug) DO NOTHING;

      -- Add school_id to all tables
      ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      ALTER TABLE grades ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);

      -- Backfill school_id for existing data (assign to default school)
      UPDATE students SET school_id = 'default-school-id' WHERE school_id IS NULL;
      UPDATE fee_transactions SET school_id = 'default-school-id' WHERE school_id IS NULL;
      UPDATE grades SET school_id = 'default-school-id' WHERE school_id IS NULL;
      UPDATE subjects SET school_id = 'default-school-id' WHERE school_id IS NULL;
      UPDATE class_subjects SET school_id = 'default-school-id' WHERE school_id IS NULL;
      UPDATE users SET school_id = 'default-school-id' WHERE school_id IS NULL AND role != 'superadmin';

      -- Make school_id NOT NULL after backfill (optional, maybe keep nullable for superadmin or shared resources?)
      -- For now, we enforce it for data integrity, except maybe users who can be superadmins
      ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;
      ALTER TABLE fee_transactions ALTER COLUMN school_id SET NOT NULL;
      ALTER TABLE grades ALTER COLUMN school_id SET NOT NULL;
      -- subjects might be shared? Let's assume per-school for now to allow custom subjects
      ALTER TABLE subjects ALTER COLUMN school_id SET NOT NULL; 
      ALTER TABLE class_subjects ALTER COLUMN school_id SET NOT NULL;

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_students_school_id ON students (school_id);
      CREATE INDEX IF NOT EXISTS idx_fees_school_id ON fee_transactions (school_id);
      CREATE INDEX IF NOT EXISTS idx_users_school_id ON users (school_id);

      -- Legacy school_config table support (deprecated but kept for safety if needed, or we can drop it)
      -- We will migrate data from school_config to schools if needed, but for now we just created a default school.

    `);
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
