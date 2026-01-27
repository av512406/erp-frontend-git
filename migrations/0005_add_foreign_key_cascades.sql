-- Migration: Add Foreign Key Cascade Rules
-- Created: 2026-01-26
-- Purpose: Add proper cascade/restrict rules to prevent orphaned records

-- Note: PostgreSQL doesn't allow direct modification of foreign keys
-- We need to drop and recreate them with proper cascade rules

-- Fee Transactions - RESTRICT delete to prevent data loss
ALTER TABLE fee_transactions 
  DROP CONSTRAINT IF EXISTS fee_transactions_student_id_students_id_fk;

ALTER TABLE fee_transactions
  ADD CONSTRAINT fee_transactions_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Grades - CASCADE delete when student is deleted
ALTER TABLE grades 
  DROP CONSTRAINT IF EXISTS grades_student_id_students_id_fk;

ALTER TABLE grades
  ADD CONSTRAINT grades_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Student Sessions - CASCADE delete when student is deleted
ALTER TABLE student_sessions 
  DROP CONSTRAINT IF EXISTS student_sessions_student_id_students_id_fk;

ALTER TABLE student_sessions
  ADD CONSTRAINT student_sessions_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Attendance - CASCADE delete when student is deleted
ALTER TABLE attendance 
  DROP CONSTRAINT IF EXISTS attendance_student_id_students_id_fk;

ALTER TABLE attendance
  ADD CONSTRAINT attendance_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Student Transport - CASCADE delete when student is deleted
ALTER TABLE student_transport 
  DROP CONSTRAINT IF EXISTS student_transport_student_id_students_id_fk;

ALTER TABLE student_transport
  ADD CONSTRAINT student_transport_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Transport Fee Transactions - RESTRICT to prevent accidental data loss
ALTER TABLE transport_fee_transactions 
  DROP CONSTRAINT IF EXISTS transport_fee_transactions_student_id_students_id_fk;

ALTER TABLE transport_fee_transactions
  ADD CONSTRAINT transport_fee_transactions_student_id_students_id_fk
  FOREIGN KEY (student_id) 
  REFERENCES students(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Session foreign keys - CASCADE when session is deleted
ALTER TABLE student_sessions 
  DROP CONSTRAINT IF EXISTS student_sessions_session_id_academic_sessions_id_fk;

ALTER TABLE student_sessions
  ADD CONSTRAINT student_sessions_session_id_academic_sessions_id_fk
  FOREIGN KEY (session_id) 
  REFERENCES academic_sessions(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Classes - SET NULL when teacher is deleted (don't delete class)
ALTER TABLE classes 
  DROP CONSTRAINT IF EXISTS classes_class_teacher_id_users_id_fk;

ALTER TABLE classes
  ADD CONSTRAINT classes_class_teacher_id_users_id_fk
  FOREIGN KEY (class_teacher_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Staff Payments - CASCADE when staff is deleted
ALTER TABLE staff_payments 
  DROP CONSTRAINT IF EXISTS staff_payments_staff_id_staff_id_fk;

ALTER TABLE staff_payments
  ADD CONSTRAINT staff_payments_staff_id_staff_id_fk
  FOREIGN KEY (staff_id) 
  REFERENCES staff(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Summary of cascade policies:
-- CASCADE: Related records deleted automatically (attendance, grades, student_sessions)
-- RESTRICT: Prevents deletion if related records exist (fee_transactions)  
-- SET NULL: Sets FK to null when parent deleted (class teacher)
-- UPDATE CASCADE: All foreign keys for consistency
