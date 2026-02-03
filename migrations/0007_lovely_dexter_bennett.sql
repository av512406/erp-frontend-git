ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_admission_number_unique";
ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_code_unique";
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_student_id_students_id_fk";
ALTER TABLE "grades" DROP CONSTRAINT IF EXISTS "grades_student_id_students_id_fk";
ALTER TABLE "student_sessions" DROP CONSTRAINT IF EXISTS "student_sessions_student_id_students_id_fk";
ALTER TABLE "student_sessions" DROP CONSTRAINT IF EXISTS "student_sessions_session_id_academic_sessions_id_fk";
ALTER TABLE "student_transport" DROP CONSTRAINT IF EXISTS "student_transport_student_id_students_id_fk";

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "session_id" varchar;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "session_id" varchar;
ALTER TABLE "staff_payments" ADD COLUMN IF NOT EXISTS "session_id" varchar;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_id_students_id_fk') THEN
        ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_session_id_academic_sessions_id_fk') THEN
        ALTER TABLE "expenses" ADD CONSTRAINT "expenses_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_student_id_students_id_fk') THEN
        ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_session_id_academic_sessions_id_fk') THEN
        ALTER TABLE "staff" ADD CONSTRAINT "staff_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_payments_session_id_academic_sessions_id_fk') THEN
        ALTER TABLE "staff_payments" ADD CONSTRAINT "staff_payments_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_student_id_students_id_fk') THEN
        ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_session_id_academic_sessions_id_fk') THEN
        ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transport_student_id_students_id_fk') THEN
        ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "student_sessions_student_session_unique" ON "student_sessions" USING btree ("student_id","session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "students_school_admission_unique" ON "students" USING btree ("school_id","admission_number");
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_code_unique" ON "subjects" USING btree ("school_id","code");