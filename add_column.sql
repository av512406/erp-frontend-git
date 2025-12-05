
-- Add previous_year_due column to students table if it doesn't exist
ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_year_due DECIMAL(10, 2) DEFAULT '0';
