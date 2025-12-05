
import ExcelJS from 'exceljs';

// Mock Data
const students = [
    { id: '1', name: 'Student A', admissionNumber: 'A001', grade: '10', section: 'A', yearlyFeeAmount: '10000', fatherName: 'Father A' },
    { id: '2', name: 'Student B', admissionNumber: 'A002', grade: '10', section: 'B', yearlyFeeAmount: '12000', fatherName: 'Father B' },
    { id: '3', name: 'Student C', admissionNumber: 'A003', grade: '9', section: 'A', yearlyFeeAmount: '10000', fatherName: 'Father C' },
    { id: '4', name: 'Student D', admissionNumber: 'A004', grade: '10', section: 'A', yearlyFeeAmount: '10000', fatherName: 'Father D' },
];

const transactions = [
    { id: 't1', studentId: '1', amount: 5000 }, // Student A paid 5000, pending 5000
    { id: 't2', studentId: '2', amount: 12000 }, // Student B paid full, pending 0
    { id: 't3', studentId: '4', amount: 2000 }, // Student D paid 2000, pending 8000
];

// 1. Calculate Pending Fees
const studentsWithPendingFees = students.map(s => {
    const yearly = parseFloat(s.yearlyFeeAmount || '0');
    const paid = transactions.filter(t => t.studentId === s.id).reduce((sum, t) => sum + (t.amount || 0), 0);
    const pending = yearly - paid;
    return { ...s, yearly, paid, pending };
}).filter(s => s.pending > 0);

console.log('Students with pending fees:', studentsWithPendingFees.length);
if (studentsWithPendingFees.length !== 3) {
    console.error('Expected 3 students with pending fees (A, C, D), got', studentsWithPendingFees.length);
    process.exit(1);
}

// 2. Filter by Class 10, Section A
const pendingFilterClass = '10';
const pendingFilterSection = 'A';

const filteredPendingStudents = studentsWithPendingFees.filter(s => {
    const classMatch = pendingFilterClass === 'all' || s.grade === pendingFilterClass;
    const sectionMatch = pendingFilterSection === 'all' || s.section === pendingFilterSection;
    return classMatch && sectionMatch;
});

console.log(`Filtered students (Class ${pendingFilterClass}, Section ${pendingFilterSection}):`, filteredPendingStudents.length);
// Should be Student A and Student D
if (filteredPendingStudents.length !== 2) {
    console.error('Expected 2 students (A, D), got', filteredPendingStudents.length);
    process.exit(1);
}

const sA = filteredPendingStudents.find(s => s.name === 'Student A');
const sD = filteredPendingStudents.find(s => s.name === 'Student D');

if (!sA || !sD) {
    console.error('Missing expected students in filtered list');
    process.exit(1);
}

// 3. Verify Excel Generation
async function verifyExcel() {
    console.log('Verifying Excel generation...');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pending Fees');

    worksheet.columns = [
        { header: 'Admission No', key: 'admissionNumber', width: 15 },
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Father Name', key: 'fatherName', width: 20 },
        { header: 'Class', key: 'grade', width: 10 },
        { header: 'Section', key: 'section', width: 10 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Yearly Fee', key: 'yearly', width: 15 },
        { header: 'Total Paid', key: 'paid', width: 15 },
        { header: 'Pending Amount', key: 'pending', width: 15 },
    ];

    filteredPendingStudents.forEach(s => {
        worksheet.addRow({
            admissionNumber: s.admissionNumber,
            name: s.name,
            fatherName: s.fatherName || '',
            grade: s.grade,
            section: s.section,
            phone: '',
            yearly: s.yearly,
            paid: s.paid,
            pending: s.pending
        });
    });

    // Check if we can write to buffer
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        console.log('Excel buffer generated successfully. Size:', buffer.byteLength);
        if (buffer.byteLength === 0) {
            throw new Error('Buffer is empty');
        }
    } catch (e) {
        console.error('Excel generation failed:', e);
        process.exit(1);
    }
}

verifyExcel().then(() => {
    console.log('Verification Passed!');
});
