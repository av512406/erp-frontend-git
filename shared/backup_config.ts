import { pgTable } from "drizzle-orm/pg-core";
import {
    schools, academicSessions, subjects, teachers, students,
    studentSessions, classSubjects, feeTransactions, grades,
    attendance, classes, transportRoutes, studentTransport, transportFeeTransactions,
    expenses, staff, staffPayments, documentTemplates, users
} from "./schema";

export interface BackupTableConfig {
    table: any; // Using any for Drizzle PgTable compatibility across versions
    name: string; // The keys used in the backup JSON data object
}

// ORDER MATTERS: Dependency Order (Parents First -> Children Last)
// Start with independent tables (schools, users, etc)
// End with leaf tables (transactions, grades, etc)
export const orderedBackupTables: BackupTableConfig[] = [
    { table: schools, name: "schools" },
    { table: users, name: "users" },
    { table: academicSessions, name: "academicSessions" },
    { table: subjects, name: "subjects" },
    { table: teachers, name: "teachers" },
    { table: staff, name: "staff" },
    { table: classes, name: "classes" },
    { table: students, name: "students" },
    // Derived/Dependent Tables
    { table: studentSessions, name: "studentSessions" },
    { table: classSubjects, name: "classSubjects" },
    { table: transportRoutes, name: "transportRoutes" },
    { table: studentTransport, name: "studentTransport" },
    { table: feeTransactions, name: "feeTransactions" },
    { table: transportFeeTransactions, name: "transportFeeTransactions" },
    { table: grades, name: "grades" },
    { table: attendance, name: "attendance" },
    { table: expenses, name: "expenses" },
    { table: staffPayments, name: "staffPayments" },
    { table: documentTemplates, name: "documentTemplates" },
];
