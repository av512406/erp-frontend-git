import type { Student } from "@shared/schema";

export type { Student };

export interface FeeTransaction {
    id: string;
    studentId: string;
    studentName: string; // derived/joined in some views
    amount: number;
    date: string;
    transactionId: string;
    paymentMode?: string;
    remarks?: string;
    receiptSerial?: number; // persisted server-side; undefined for legacy entries
    createdAt?: string;
    status?: string;
    cancelReason?: string;
}

export interface GradeEntry {
    studentId: string;
    subject: string;
    marks: number | string; // Allow string for input handling, though backend expects number/string
    term: string;
}

export interface ExtendedStudent extends Student {
    yearlyFeeAmount?: string | number;
    previousYearDue?: number;
    paidSoFar?: number;
}
// Import Interfaces
export interface ImportSummary {
    added: number;
    skipped: number;
    skippedAdmissionNumbers?: string[];
    updated?: number;
    inserted?: number;
    skippedRows?: any[];
}

export interface RawStudentRow {
    admissionNumber: string;
    name: string;
    dateOfBirth?: string;
    admissionDate?: string;
    aadharNumber?: string;
    penNumber?: string;
    aaparId?: string;
    mobileNumber?: string;
    address?: string;
    grade?: string;
    section?: string;
    fatherName?: string;
    motherName?: string;
    yearlyFeeAmount?: string;
    category?: string;
    gender?: string;
    previousYearDue?: string;
    isRTE?: string;
}

export interface RawGradeRow {
    admissionNumber: string; // Used for mapping in imports usually
    studentId?: string;
    subject: string;
    marks: number | string;
    term: string;
}

export interface RawTransactionRow {
    admissionNumber: string; // Used for imports mapping
    studentId?: string;
    amount: string;
    paymentDate: string;
    paymentMode?: string;
    remarks?: string;
}

export interface SchoolDetails {
    name: string;
    address: string;
    affiliationNo: string;
    schoolCode: string;
    logoUrl?: string;
    phone?: string;
    email?: string;
}

export interface StudentTCDetails {
    tcNumber: string;
    admissionNumber: string;
    studentName: string;
    motherName: string;
    fatherName: string;
    dob: string;
    nationality: string;
    casteCategory: string; // SC/ST/OBC/General
    dateOfAdmission: string;
    classAdmitted: string;
    currentClass: string;
    lastExamResult: string;
    qualifiedForPromotion: string; // "Yes" / "No"
    subjectsStudied: string;
    apaarId: string; // "One Nation, One Student ID"
    penNumber: string; // UDISE+ PEN
    generalConduct: string; // "Good"
    dateOfIssue: string;
    reasonForLeaving: string;
}
