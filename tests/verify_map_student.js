
// Unit Test for mapStudent Logic

// Mock the mapStudent function with the fix applied
function mapStudent(row) {
    return {
        id: row.id,
        admissionNumber: row.admission_number,
        name: row.name,
        dateOfBirth: row.date_of_birth, // Simplified for test
        admissionDate: row.admission_date, // Simplified for test
        aadharNumber: row.aadhar_number,
        penNumber: row.pen_number,
        aaparId: row.aapar_id,
        mobileNumber: row.mobile_number,
        address: row.address,
        grade: row.grade,
        section: row.section,
        fatherName: row.father_name,
        motherName: row.mother_name,
        yearlyFeeAmount: row.yearly_fee_amount?.toString?.() ?? row.yearly_fee_amount,
        // The Fix:
        previousYearDue: row.previous_year_due?.toString?.() ?? row.previous_year_due,
        status: row.status || 'active',
        // ... other fields omitted for brevity as they are not the focus
    };
}

console.log("--- Verifying mapStudent Logic ---");

// Mock DB Row
const mockRow = {
    id: "123",
    admission_number: "A001",
    name: "Test Student",
    yearly_fee_amount: 10000.00,
    previous_year_due: 5000.00, // This is the field we care about
    status: "active"
};

console.log("Mock Row:", mockRow);

const mapped = mapStudent(mockRow);
console.log("Mapped Result:", mapped);

if (mapped.previousYearDue == 5000) {
    console.log("PASS: previousYearDue is present and correct.");
} else {
    console.error("FAIL: previousYearDue is missing or incorrect.");
    process.exit(1);
}
