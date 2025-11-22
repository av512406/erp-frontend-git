import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionNumber: text("admission_number").notNull().unique(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  admissionDate: date("admission_date").notNull(),
  aadharNumber: text("aadhar_number").notNull(),
  penNumber: text("pen_number").notNull(),
  aaparId: text("aapar_id").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  address: text("address").notNull(),
  grade: text("grade").notNull(),
  section: text("section").notNull(),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  yearlyFeeAmount: decimal("yearly_fee_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
  leftDate: date("left_date"),
  leavingReason: text("leaving_reason"),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  dateOfJoining: date("date_of_joining").notNull(),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  address: text("address").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  qualification: text("qualification").notNull(),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
});

export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

export const feeTransactions = pgTable("fee_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  transactionId: text("transaction_id").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMode: text("payment_mode").notNull(),
  remarks: text("remarks"),
  // Persisted receipt serial to ensure reprints show original number.
  // Nullable for legacy rows prior to introduction; new inserts should supply a value.
  receiptSerial: integer("receipt_serial") // sequence-backed default applied via migration (not declared here to avoid runtime mismatch if sequence absent)
});

export const insertFeeTransactionSchema = createInsertSchema(feeTransactions).omit({
  id: true,
  transactionId: true, // server generates unique transactionId
});

export type InsertFeeTransaction = z.infer<typeof insertFeeTransactionSchema>;
export type FeeTransaction = typeof feeTransactions.$inferSelect;

export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  subject: text("subject").notNull(),
  marks: decimal("marks", { precision: 5, scale: 2 }).notNull(),
  term: text("term").notNull(),
});

export const insertGradeSchema = createInsertSchema(grades).omit({
  id: true,
});

export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof grades.$inferSelect;

// Subjects catalog (for persistence)
export const subjects = pgTable("subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// 1) Add column
// ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS receipt_serial integer;

// 2) Create sequence if missing
// DO $$
// BEGIN
//   IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_serial_seq') THEN
//     CREATE SEQUENCE receipt_serial_seq OWNED BY fee_transactions.receipt_serial;
//   END IF;
// END$$;

// 3) Backfill null serials in chronological order
// WITH ordered AS (
//   SELECT id,
//          ROW_NUMBER() OVER (ORDER BY payment_date, id) AS rn
//   FROM fee_transactions
//   WHERE receipt_serial IS NULL
// )
// UPDATE fee_transactions f
// SET receipt_serial = ordered.rn
// FROM ordered
// WHERE f.id = ordered.id;

// 4) Set default to sequence
// ALTER TABLE fee_transactions ALTER COLUMN receipt_serial SET DEFAULT nextval('receipt_serial_seq');

// 5) Align sequence to max
// SELECT setval('receipt_serial_seq', COALESCE((SELECT MAX(receipt_serial) FROM fee_transactions),0));

// 6) Optional: Unique index
// CREATE UNIQUE INDEX IF NOT EXISTS fee_transactions_receipt_serial_unique ON fee_transactions(receipt_serial);
