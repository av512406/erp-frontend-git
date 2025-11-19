import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date } from "drizzle-orm/pg-core";
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
