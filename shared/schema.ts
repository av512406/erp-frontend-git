import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  currentSessionId: varchar("current_session_id"), // FK to academic_sessions added later to avoid circular dep issues in TS if needed, but for Drizzle it's just a string field unless we use relations.
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('teacher'),
  name: text("name").notNull().default('User'),
  schoolId: varchar("school_id").references(() => schools.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  name: true,
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
  status: text("status").notNull().default('active'),
  leftDate: date("left_date"),
  leavingReason: text("leaving_reason"),
  category: text("category").default('GEN'),
  gender: text("gender"),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  schoolId: true,
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
  schoolId: varchar("school_id").notNull().references(() => schools.id),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  schoolId: true,
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
  receiptSerial: integer("receipt_serial"),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id"), // FK to academic_sessions
});

export const insertFeeTransactionSchema = createInsertSchema(feeTransactions).omit({
  id: true,
  transactionId: true,
  receiptSerial: true,
  schoolId: true,
});

export type InsertFeeTransaction = z.infer<typeof insertFeeTransactionSchema>;
export type FeeTransaction = typeof feeTransactions.$inferSelect;

export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  subject: text("subject").notNull(),
  marks: decimal("marks", { precision: 5, scale: 2 }).notNull(),
  term: text("term").notNull(),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id"), // FK to academic_sessions
});

export const insertGradeSchema = createInsertSchema(grades).omit({
  id: true,
  schoolId: true,
});

export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof grades.$inferSelect;

export const subjects = pgTable("subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, schoolId: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// Class-Subjects (Assignments)
export const classSubjects = pgTable("class_subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  grade: text("grade").notNull(),
  subjectId: varchar("subject_id").notNull().references(() => subjects.id),
  maxMarks: decimal("max_marks", { precision: 6, scale: 2 }),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
});

export const insertClassSubjectSchema = createInsertSchema(classSubjects).omit({ id: true, schoolId: true });
export type InsertClassSubject = z.infer<typeof insertClassSubjectSchema>;
export type ClassSubject = typeof classSubjects.$inferSelect;

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  type: text("type").notNull(), // 'report_card', 'transfer_certificate', 'payslip'
  content: text("content").notNull(), // HTML template
  config: text("config"), // JSON string for additional config
  updatedAt: date("updated_at").defaultNow(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  schoolId: true,
  updatedAt: true,
});

export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// --- Session Management ---

export const academicSessions = pgTable("academic_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "2025-2026"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false),
  schoolId: varchar("school_id").notNull().references(() => schools.id), // Sessions are per-school or global? Plan said global but per-school gives flexibility. Let's stick to global for now as per plan, but wait, the plan said "Super Admin creates Global Session Definitions". So maybe no schoolId here if it's global.
  // Actually, usually sessions are global definitions, but schools might activate them at different times.
  // Let's make it global for now as per plan: "Super Admin creates Global Session Definitions".
});

// We need to update schools to link to current session
// This is a circular dependency if we reference academicSessions here directly in the schools definition above.
// But we can't change the order easily without breaking things.
// For now, we will add the column in SQL but maybe not enforce the FK constraint strictly in Drizzle if it causes issues, or just define it.
// Actually, Drizzle handles this fine if we define it. But `schools` is defined at the top.
// Let's leave `schools` definition as is for now and just know we will add the column.
// Wait, I should update `schools` definition too.

export const studentSessions = pgTable("student_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  sessionId: varchar("session_id").notNull().references(() => academicSessions.id),
  grade: text("grade").notNull(),
  section: text("section").notNull(),
  rollNumber: text("roll_number"),
  status: text("status").notNull().default('active'), // promoted, detained, active
  schoolId: varchar("school_id").notNull().references(() => schools.id),
});

export const insertAcademicSessionSchema = createInsertSchema(academicSessions).omit({ id: true });
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;
export type AcademicSession = typeof academicSessions.$inferSelect;

export const insertStudentSessionSchema = createInsertSchema(studentSessions).omit({ id: true });
export type InsertStudentSession = z.infer<typeof insertStudentSessionSchema>;
export type StudentSession = typeof studentSessions.$inferSelect;
