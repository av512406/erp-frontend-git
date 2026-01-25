ALTER TABLE "student_sessions" ADD COLUMN "transport_fee" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "transport_fee";