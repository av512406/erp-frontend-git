import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, integer, boolean, timestamp, json, uniqueIndex } from "drizzle-orm/pg-core";
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
  currentSessionId: varchar("current_session_id"),
  examPattern: text("exam_pattern").default('["Term 1", "Term 2", "Final"]'), // JSON string
  features: text("features").default('{"attendance": false}'), // JSON string: { "attendance": boolean, ... }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('teacher'),
  name: text("name").notNull().default('User'),
  schoolId: varchar("school_id").references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  name: true,
}).extend({
  username: z.string().email("Invalid email format"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionNumber: text("admission_number").notNull(),
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
  previousYearDue: decimal("previous_year_due", { precision: 10, scale: 2 }).default('0'),
  status: text("status").notNull().default('active'),
  leftDate: date("left_date"),
  leavingReason: text("leaving_reason"),
  category: text("category").default('GEN'),
  gender: text("gender"),
  nationality: text("nationality").default('Indian'),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  unq: uniqueIndex("students_school_admission_unique").on(t.schoolId, t.admissionNumber),
}));

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  schoolId: true,
}).extend({
  yearlyFeeAmount: z.string().optional(),
  transportFee: z.string().optional(),
  session: z.string().optional(),
  sessionName: z.string().optional(),
  isRTE: z.boolean().optional().or(z.string().optional()) // Allow boolean or string "true"/"yes" for import
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
  userId: varchar("user_id").references(() => users.id),
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
  status: text("status").notNull().default('active'), // 'active', 'cancelled'
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeeTransactionSchema = createInsertSchema(feeTransactions).omit({
  id: true,
  transactionId: true,
  receiptSerial: true,
  schoolId: true,
  status: true,
  cancelReason: true,
});

export type InsertFeeTransaction = z.infer<typeof insertFeeTransactionSchema>;
export type FeeTransaction = typeof feeTransactions.$inferSelect;

export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
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
  code: text("code").notNull(),
  name: text("name").notNull(),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
}, (t) => ({
  unq: uniqueIndex("subjects_school_code_unique").on(t.schoolId, t.code),
}));

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

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
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
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  grade: text("grade").notNull(),
  section: text("section").notNull(),
  rollNumber: text("roll_number"),
  status: text("status").notNull().default('active'), // promoted, detained, active
  yearlyFeeAmount: decimal("yearly_fee_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  transportFee: decimal("transport_fee", { precision: 10, scale: 2 }).default('0'),
  isRTE: boolean("is_rte").default(false),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
}, (t) => ({
  unq: uniqueIndex("student_sessions_student_session_unique").on(t.studentId, t.sessionId),
}));

export const insertAcademicSessionSchema = createInsertSchema(academicSessions).omit({ id: true });
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;
export type AcademicSession = typeof academicSessions.$inferSelect;

export const insertStudentSessionSchema = createInsertSchema(studentSessions).omit({ id: true });
export type InsertStudentSession = z.infer<typeof insertStudentSessionSchema>;
export type StudentSession = typeof studentSessions.$inferSelect;

// --- Attendance System ---

export const classes = pgTable("classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  grade: text("grade").notNull(),
  section: text("section").notNull(),
  classTeacherId: text("class_teacher_id").references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  unq: uniqueIndex("classes_school_grade_section_unique").on(t.schoolId, t.grade, t.section),
}));

export const insertClassSchema = createInsertSchema(classes).omit({ id: true, schoolId: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: text("status").notNull(), // Present, Absent, Leave, Late
  sessionId: varchar("session_id").references(() => academicSessions.id),
  markedBy: varchar("marked_by").references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  // Composite unique constraint on student + date to prevent duplicate marking
  // Again, will ensure in SQL migration for robustness.
}));

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, schoolId: true, markedBy: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

// --- Transport System ---

export const transportRoutes = pgTable("transport_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Route 1 - Downtown"
  feeAmount: decimal("fee_amount", { precision: 10, scale: 2 }).notNull(), // Annual Fee
  vehicleNumber: text("vehicle_number"),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTransportRouteSchema = createInsertSchema(transportRoutes).omit({ id: true, schoolId: true });
export type InsertTransportRoute = z.infer<typeof insertTransportRouteSchema>;
export type TransportRoute = typeof transportRoutes.$inferSelect;

export const studentTransport = pgTable("student_transport", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  // routeId: varchar("route_id").notNull().references(() => transportRoutes.id), // Deprecated/Removed
  transportType: text("transport_type").notNull().default('Bus'), // 'Bus' or 'Van'
  yearlyFee: decimal("yearly_fee", { precision: 10, scale: 2 }).notNull().default('0'),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id").notNull().references(() => academicSessions.id),
  // Deprecated usage but kept for schema alignment if DB has it
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentTransportSchema = createInsertSchema(studentTransport).omit({ id: true, schoolId: true });
export type InsertStudentTransport = z.infer<typeof insertStudentTransportSchema>;
export type StudentTransport = typeof studentTransport.$inferSelect;

export const transportFeeTransactions = pgTable("transport_fee_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  remarks: text("remarks"),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id").notNull().references(() => academicSessions.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTransportFeeTransactionSchema = createInsertSchema(transportFeeTransactions).omit({ id: true, schoolId: true });
export type InsertTransportFeeTransaction = z.infer<typeof insertTransportFeeTransactionSchema>;
export type TransportFeeTransaction = typeof transportFeeTransactions.$inferSelect;

// --- Finance: Expense Management ---

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // e.g., 'utilities', 'maintenance', 'events', 'salary', 'other'
  date: date("date").notNull(),
  paymentMethod: text("payment_method"), // 'cash', 'bank_transfer', 'cheque', etc.
  receiptUrl: text("receipt_url"), // Optional URL to stored image
  recordedBy: varchar("recorded_by").references(() => users.id), // User who entered the record
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id").references(() => academicSessions.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, schoolId: true, recordedBy: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// --- Staff Management (Session-Independent) ---

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position").notNull(), // e.g., "Teacher", "Accountant", "Peon"
  monthlySalary: decimal("monthly_salary", { precision: 10, scale: 2 }).notNull(),
  joiningDate: date("joining_date"),
  status: text("status").notNull().default('active'), // active, inactive
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// --- Finance: Staff Payments (Salary) ---

export const staffPayments = pgTable("staff_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id), // Reference new staff table
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: text("month").notNull(), // e.g., "January"
  year: integer("year").notNull(), // e.g., 2025
  paymentDate: date("payment_date").notNull(),
  status: text("status").notNull().default('Paid'), // 'Paid', 'Pending'
  remarks: text("remarks"),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  sessionId: varchar("session_id").references(() => academicSessions.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStaffPaymentSchema = createInsertSchema(staffPayments).omit({ id: true, schoolId: true });
export type InsertStaffPayment = z.infer<typeof insertStaffPaymentSchema>;
export type StaffPayment = typeof staffPayments.$inferSelect;
