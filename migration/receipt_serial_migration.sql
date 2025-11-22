-- migration/receipt_serial_migration.sql
-- 1) Add column if missing
ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS receipt_serial integer;

-- 2) Create sequence if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_serial_seq') THEN
    CREATE SEQUENCE receipt_serial_seq OWNED BY fee_transactions.receipt_serial;
  END IF;
END$$;

-- 3) Backfill NULL serials in chronological order (idempotent)
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY payment_date, id) AS rn
  FROM fee_transactions
  WHERE receipt_serial IS NULL
)
UPDATE fee_transactions f
SET receipt_serial = ordered.rn
FROM ordered
WHERE f.id = ordered.id;

-- 4) Set default to sequence (safe to run multiple times)
ALTER TABLE fee_transactions ALTER COLUMN receipt_serial SET DEFAULT nextval('receipt_serial_seq');

-- 5) Align sequence to max value
SELECT setval('receipt_serial_seq', COALESCE((SELECT MAX(receipt_serial) FROM fee_transactions),0));

-- 6) Optional: unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS fee_transactions_receipt_serial_unique ON fee_transactions(receipt_serial);
