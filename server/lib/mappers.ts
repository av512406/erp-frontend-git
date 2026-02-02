
export function formatDateForClient(v: any) {
    if (v == null) return '';
    // If it's already a YYYY-MM-DD string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // If it's an ISO timestamp string
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    // If it's a Date object
    if (v instanceof Date && !isNaN(v.getTime())) {
        const year = v.getFullYear();
        const month = String(v.getMonth() + 1).padStart(2, '0');
        const day = String(v.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    // Fallback: try to parse and format
    try {
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch { }
    return '';
}

export function mapStudent(row: any) {
    return {
        id: row.id,
        admissionNumber: row.admissionNumber || row.admission_number,
        name: row.name,
        rollNumber: row.rollNumber || row.roll_number, // Added roll number mapping
        // normalize date fields to YYYY-MM-DD strings so frontend <input type="date"> can display them
        dateOfBirth: formatDateForClient(row.dateOfBirth || row.date_of_birth),
        admissionDate: formatDateForClient(row.admissionDate || row.admission_date),
        aadharNumber: row.aadharNumber || row.aadhar_number,
        penNumber: row.penNumber || row.pen_number,
        aaparId: row.aaparId || row.aapar_id,
        mobileNumber: row.mobileNumber || row.mobile_number,
        address: row.address,
        grade: row.grade,
        section: row.section,
        fatherName: row.fatherName || row.father_name,
        motherName: row.motherName || row.mother_name,
        yearlyFeeAmount: row.yearlyFeeAmount || row.session_fee?.toString?.() || row.yearly_fee_amount?.toString?.() || '0',
        previousYearDue: row.previousYearDue?.toString?.() ?? row.previous_year_due?.toString?.() ?? row.previous_year_due,
        status: row.status || 'active',
        leftDate: formatDateForClient(row.leftDate || row.left_date),
        leavingReason: row.leavingReason || row.leaving_reason || '',
        category: row.category || 'GEN',
        gender: row.gender || '',
        transportFee: row.transportFee || row.transport_fee?.toString?.() || '0',
        isRTE: row.isRTE || row.is_rte || false
    };
}

export function mapGrade(row: any) {
    return {
        id: row.id,
        studentId: row.studentId || row.student_id,
        subject: row.subject,
        marks: parseFloat(row.marks),
        term: row.term,
    };
}

export function mapSubject(row: any) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        maxMarks: (row.maxMarks !== undefined ? parseFloat(row.maxMarks) : (row.max_marks !== undefined ? (row.max_marks !== null ? parseFloat(row.max_marks) : null) : undefined)),
    };
}
