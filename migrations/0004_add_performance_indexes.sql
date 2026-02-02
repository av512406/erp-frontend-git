-- Migration: Add Performance Indexes
-- Created: 2026-01-26
-- Purpose: Add indexes for commonly queried columns to improve performance

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_school_session 
  ON students(school_id, grade, section) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_students_admission_number 
  ON students(admission_number);

CREATE INDEX IF NOT EXISTS idx_students_status 
  ON students(school_id, status);

-- Student Sessions indexes
CREATE INDEX IF NOT EXISTS idx_student_sessions_session 
  ON student_sessions(session_id, school_id);

CREATE INDEX IF NOT EXISTS idx_student_sessions_student 
  ON student_sessions(student_id, session_id);

-- Fee Transactions indexes
CREATE INDEX IF NOT EXISTS idx_fees_student_session 
  ON fee_transactions(student_id, session_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_fees_school_session_date 
  ON fee_transactions(school_id, session_id, payment_date DESC) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_fees_payment_date 
  ON fee_transactions(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_fees_status 
  ON fee_transactions(school_id, status);

-- Grades indexes
CREATE INDEX IF NOT EXISTS idx_grades_student_session 
  ON grades(student_id, session_id);

CREATE INDEX IF NOT EXISTS idx_grades_school_session 
  ON grades(school_id, session_id);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
  ON attendance(student_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_school_date 
  ON attendance(school_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_session 
  ON attendance(session_id, date DESC);

-- Classes indexes
CREATE INDEX IF NOT EXISTS idx_classes_school_grade_section 
  ON classes(school_id, grade, section);

CREATE INDEX IF NOT EXISTS idx_classes_teacher 
  ON classes(class_teacher_id) 
  WHERE class_teacher_id IS NOT NULL;

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_school 
  ON users(school_id) 
  WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role 
  ON users(role, school_id);

-- Staff indexes
-- Staff indexes
-- (Commented out because staff table is created in 0006)
-- CREATE INDEX IF NOT EXISTS idx_staff_school_status 
--   ON staff(school_id, status);

-- Transport indexes
CREATE INDEX IF NOT EXISTS idx_student_transport_session 
  ON student_transport(session_id, school_id);

CREATE INDEX IF NOT EXISTS idx_student_transport_student 
  ON student_transport(student_id, session_id);

-- Academic Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_school_active 
  ON academic_sessions(school_id, is_active);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_students_full_search 
  ON students(school_id, status, grade, section);

-- Performance note: These indexes will speed up:
-- 1. Student lookups by school, grade, session
-- 2. Fee calculations by session  
-- 3. Grade reports
-- 4. Attendance tracking
-- 5. Financial reports and dashboard stats
