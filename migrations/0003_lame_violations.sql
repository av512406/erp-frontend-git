ALTER TABLE "student_sessions" ADD COLUMN "yearly_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "yearly_fee_amount";