-- Add staff table (session-independent)
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  monthly_salary DECIMAL(10,2) NOT NULL,
  joining_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  school_id TEXT NOT NULL REFERENCES schools(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optionally migrate existing teachers to staff
-- INSERT INTO staff (id, name, email, phone, position, monthly_salary, joining_date, status, school_id, created_at)
-- SELECT id, name, NULL as email, mobile_number as phone, 'Teacher' as position, salary, date_of_joining, 'active', school_id, NOW()
-- FROM teachers
-- ON CONFLICT (id) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_school_id ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
