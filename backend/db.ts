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
    -- receipt serial column managed by sequence (idempotent)
    ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS receipt_serial integer;
  -- ensure timestamp columns exist for legacy tables
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
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

      -- School configuration (single-row table). Stores basic metadata and optional base64 logo.
      CREATE TABLE IF NOT EXISTS school_config (
        id text PRIMARY KEY,
        name text NOT NULL,
        address_line text NOT NULL,
        phone text,
        session text,
        logo_url text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      -- Ensure default row exists
      INSERT INTO school_config (id, name, address_line, phone, session, logo_url)
      VALUES ('default','GLORIOUS PUBLIC SCHOOL','Jamoura (Sarkhadi), Distt. LALITPUR (U.P)','+91-0000-000000','2025-2026', NULL)
      ON CONFLICT (id) DO NOTHING;

      -- =========================
      -- Receipt Serial Sequence Bootstrap (idempotent)
      -- =========================
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'receipt_serial_seq') THEN
          CREATE SEQUENCE receipt_serial_seq START 1;
        END IF;
      END $$;

      -- Set default to consume sequence if column exists
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='fee_transactions' AND column_name='receipt_serial'
        ) THEN
          ALTER TABLE fee_transactions ALTER COLUMN receipt_serial SET DEFAULT nextval('receipt_serial_seq');
        END IF;
      END $$;

      -- Backfill NULL receipt_serials using sequence for legacy rows (only where still null)
      DO $$
      DECLARE
        _row RECORD;
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='fee_transactions' AND column_name='receipt_serial'
        ) THEN
          FOR _row IN SELECT id FROM fee_transactions WHERE receipt_serial IS NULL ORDER BY id LOOP
            UPDATE fee_transactions SET receipt_serial = nextval('receipt_serial_seq') WHERE id = _row.id;
          END LOOP;
        END IF;
      END $$;

      -- Ensure sequence is at least max(receipt_serial)+1 (handles cases where sequence existed but was behind)
      DO $$
      DECLARE
        max_serial BIGINT;
        seq_last BIGINT;
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='receipt_serial_seq') THEN
          SELECT COALESCE(MAX(receipt_serial),0) INTO max_serial FROM fee_transactions;
          SELECT last_value INTO seq_last FROM receipt_serial_seq;
          IF max_serial >= seq_last THEN
            PERFORM setval('receipt_serial_seq', max_serial + 1, false);
          END IF;
        END IF;
      END $$;

      -- Helpful index for retrieval / uniqueness scanning (non-unique, serial ordering)
      CREATE INDEX IF NOT EXISTS idx_fee_transactions_receipt_serial ON fee_transactions (receipt_serial);

      -- =========================
      -- Immutable Receipt Ledger Tables
      -- =========================
      CREATE TABLE IF NOT EXISTS receipt_ledger (
        id text PRIMARY KEY,
        fee_transaction_id text UNIQUE NOT NULL REFERENCES fee_transactions(id) ON DELETE CASCADE,
        student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        receipt_serial integer,
        payment_date date NOT NULL,
        total_amount numeric(10,2) NOT NULL,
        items_json jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS receipt_ledger_items (
        id text PRIMARY KEY,
        ledger_id text NOT NULL REFERENCES receipt_ledger(id) ON DELETE CASCADE,
        label text NOT NULL,
        amount numeric(10,2) NOT NULL,
        position integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_receipt_ledger_serial ON receipt_ledger (receipt_serial);
      CREATE INDEX IF NOT EXISTS idx_receipt_ledger_student ON receipt_ledger (student_id);

      -- Immutable triggers to prevent UPDATE/DELETE (enforce append-only)
      CREATE OR REPLACE FUNCTION immutable_row() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'immutable table – UPDATE/DELETE not allowed';
      END;$$ LANGUAGE plpgsql;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='receipt_ledger_no_update') THEN
          CREATE TRIGGER receipt_ledger_no_update BEFORE UPDATE OR DELETE ON receipt_ledger FOR EACH ROW EXECUTE FUNCTION immutable_row();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='receipt_ledger_items_no_update') THEN
          CREATE TRIGGER receipt_ledger_items_no_update BEFORE UPDATE OR DELETE ON receipt_ledger_items FOR EACH ROW EXECUTE FUNCTION immutable_row();
        END IF;
      END$$;

      -- =========================
      -- Users table for authentication & RBAC
      -- =========================
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'admin', -- 'admin' | 'teacher'
        name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      -- trigger for updated_at
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
          CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;
      -- Seed default admin if none exists (idempotent, unsafe default password must be rotated in production)
      DO $$
      DECLARE
        existing_admin_count integer;
      BEGIN
        SELECT COUNT(*) INTO existing_admin_count FROM users WHERE role='admin';
        IF existing_admin_count = 0 THEN
          INSERT INTO users (id, email, password_hash, role, name)
          VALUES (gen_random_uuid()::text, 'admin@example.com', '$2b$10$PLACEHOLDERHASH', 'admin', 'Default Admin');
        END IF;
      END $$;
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
