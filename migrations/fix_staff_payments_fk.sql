-- Drop old foreign key constraint referencing teachers
ALTER TABLE staff_payments 
DROP CONSTRAINT IF EXISTS staff_payments_staff_id_teachers_id_fk;

-- Add new foreign key constraint referencing staff
ALTER TABLE staff_payments 
ADD CONSTRAINT staff_payments_staff_id_staff_id_fk 
FOREIGN KEY (staff_id) REFERENCES staff(id);
