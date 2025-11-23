// Workspace copy of original schema definitions.
// (Original monolithic file was at root shared/schema.ts; kept duplicated here for gradual migration.)
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable('users', {
	id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role').notNull(),
	name: text('name'),
	createdAt: date('created_at'),
	updatedAt: date('updated_at'),
});
export const registerUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	role: z.enum(['admin', 'teacher']).optional(),
	name: z.string().min(1).optional()
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;

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
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export const feeTransactions = pgTable("fee_transactions", {
	id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
	studentId: varchar("student_id").notNull().references(() => students.id),
	transactionId: text("transaction_id").notNull().unique(),
	amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
	paymentDate: date("payment_date").notNull(),
	paymentMode: text("payment_mode").notNull(),
	remarks: text("remarks"),
	receiptSerial: integer("receipt_serial")
});
export const insertFeeTransactionSchema = createInsertSchema(feeTransactions).omit({ id: true, transactionId: true });
export type InsertFeeTransaction = z.infer<typeof insertFeeTransactionSchema>;
export type FeeTransaction = typeof feeTransactions.$inferSelect;

export const grades = pgTable("grades", {
	id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
	studentId: varchar("student_id").notNull().references(() => students.id),
	subject: text("subject").notNull(),
	marks: decimal("marks", { precision: 5, scale: 2 }).notNull(),
	term: text("term").notNull(),
});
export const insertGradeSchema = createInsertSchema(grades).omit({ id: true });
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof grades.$inferSelect;

export const subjects = pgTable("subjects", {
	id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
	code: text("code").notNull().unique(),
	name: text("name").notNull(),
});
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

export const receiptLedger = pgTable('receipt_ledger', {
	id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
	feeTransactionId: varchar('fee_transaction_id').notNull(),
	studentId: varchar('student_id').notNull(),
	receiptSerial: integer('receipt_serial'),
	paymentDate: date('payment_date').notNull(),
	totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
	itemsJson: text('items_json'),
});
export const receiptLedgerItems = pgTable('receipt_ledger_items', {
	id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
	ledgerId: varchar('ledger_id').notNull(),
	label: text('label').notNull(),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	position: integer('position').notNull(),
});
export const receiptLedgerItemSchema = z.object({ label: z.string().min(1), amount: z.number().nonnegative() });
export const createReceiptLedgerSchema = z.object({ items: z.array(receiptLedgerItemSchema).min(1) });
export type ReceiptLedgerItemInput = z.infer<typeof receiptLedgerItemSchema>;
export type CreateReceiptLedgerInput = z.infer<typeof createReceiptLedgerSchema>;

export const studentLeaveSchema = z.object({
	leftDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
	reason: z.string().trim().min(1).max(300).optional()
});
export const classSubjectAssignSchema = z.object({ subjectId: z.string().trim().min(1), maxMarks: z.number().int().positive().max(1000).optional() });
export const classSubjectUpdateSchema = z.object({ maxMarks: z.number().int().positive().max(1000).nullable().optional() });
export const feeTransactionImportRowSchema = insertFeeTransactionSchema.partial().extend({ amount: z.union([z.string(), z.number()]).optional(), remarks: z.string().trim().max(300).optional() });
export const feeTransactionImportSchema = z.array(feeTransactionImportRowSchema).min(1);
export const gradeBulkRowSchema = insertGradeSchema;
export const gradeBulkArraySchema = z.array(gradeBulkRowSchema).min(1);
export const studentImportRowSchema = insertStudentSchema;
export const studentImportSchema = z.object({ students: z.array(studentImportRowSchema).min(1), strategy: z.enum(['skip', 'upsert']).optional() });

