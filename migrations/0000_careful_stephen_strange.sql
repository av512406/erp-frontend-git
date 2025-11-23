CREATE TABLE "fee_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_mode" text NOT NULL,
	"remarks" text,
	"receipt_serial" integer,
	CONSTRAINT "fee_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"marks" numeric(5, 2) NOT NULL,
	"term" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_transaction_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"receipt_serial" integer,
	"payment_date" date NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"items_json" text
);
--> statement-breakpoint
CREATE TABLE "receipt_ledger_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_id" varchar NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_number" text NOT NULL,
	"name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"admission_date" date NOT NULL,
	"aadhar_number" text NOT NULL,
	"pen_number" text NOT NULL,
	"aapar_id" text NOT NULL,
	"mobile_number" text NOT NULL,
	"address" text NOT NULL,
	"grade" text NOT NULL,
	"section" text NOT NULL,
	"father_name" text,
	"mother_name" text,
	"yearly_fee_amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"left_date" date,
	"leaving_reason" text,
	CONSTRAINT "students_admission_number_unique" UNIQUE("admission_number")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"created_at" date,
	"updated_at" date,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;