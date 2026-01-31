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
