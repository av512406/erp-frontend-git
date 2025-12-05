
// Verification script for Student Import Logic (mimicking DataToolsPage.tsx)

// Verification script for Student Import Logic (mimicking DataToolsPage.tsx)

// const Papa = require('papaparse'); // Removed unused require 
// Actually, papaparse might not be installed in node_modules for the server context if it's a client lib.
// Let's check package.json first. If not, I'll implement a simple mock parser or just use string splitting for this test if simple.
// But wait, the client code uses window.Papa. 
// I will implement a simple CSV parser for the test or just mock the input object that Papa would produce.

// The logic I changed is inside the `complete` callback of Papa.parse.
// It takes `results.data` which is an array of objects (if header: true).

console.log("--- Verifying Import Logic ---");

// Mock Data mimicking Papa.parse output
const mockResults = {
    data: [
        {
            "Admission Number": "A001",
            "Name": "Student One",
            "Yearly Fees": "10000",
            "Previous Year Due": "5000", // The new column
            "Class": "10",
            "Section": "A"
        },
        {
            "admissionNumber": "A002",
            "name": "Student Two",
            "yearlyFeeAmount": "12000",
            "previousYearDue": "2500.50", // CamelCase variant
            "grade": "10",
            "section": "B"
        },
        {
            "AdmissionNo": "A003",
            "Name": "Student Three",
            "YearlyFees": "15000",
            // Missing previous due, should default to empty string -> handled by backend or logic?
            // The logic says: const previousYearDue = pydRaw === undefined || pydRaw === null ? '' : normalizeNumberString(pydRaw);
            "Class": "10",
            "Section": "C"
        }
    ]
};

// Helper functions from DataToolsPage.tsx
const normalize = (val) => typeof val === 'string' ? val.trim() : (val || '');
const normalizeNumberString = (val) => {
    const s = String(val || '').replace(/,/g, '').trim();
    return s;
};

// The mapping logic from DataToolsPage.tsx
const importedStudents = mockResults.data
    .map((row) => {
        const admissionNumber = normalize(row.admissionNumber || row['Admission Number'] || row['AdmissionNo'] || row['Admission No'] || row['admission no']);
        const name = normalize(row.name || row['Name']);

        // ... (omitting date/other fields for brevity) ...

        const yfaRaw = row.yearlyFeeAmount || row['Yearly fees'] || row['Yearly Fees'] || row['yearly fees'] || row['Yearly_Fees'] || row['YearlyFee'] || row['yearlyFeeAmount'];
        const yearlyFeeAmount = yfaRaw === undefined || yfaRaw === null ? '' : normalizeNumberString(yfaRaw);

        // THE NEW LOGIC
        const pydRaw = row.previousYearDue || row['Previous Year Due'] || row['Previous Due'] || row['previous year due'] || row['previous due'] || row['previousYearDue'];
        const previousYearDue = pydRaw === undefined || pydRaw === null ? '' : normalizeNumberString(pydRaw);

        return {
            admissionNumber,
            name,
            yearlyFeeAmount,
            previousYearDue
        };
    });

console.log("Imported Students:", importedStudents);

// Assertions
let pass = true;

if (importedStudents[0].previousYearDue !== "5000") {
    console.error("FAIL: Row 1 previousYearDue mismatch. Expected '5000', got", importedStudents[0].previousYearDue);
    pass = false;
}

if (importedStudents[1].previousYearDue !== "2500.50") {
    console.error("FAIL: Row 2 previousYearDue mismatch. Expected '2500.50', got", importedStudents[1].previousYearDue);
    pass = false;
}

if (importedStudents[2].previousYearDue !== "") {
    console.error("FAIL: Row 3 previousYearDue mismatch. Expected '', got", importedStudents[2].previousYearDue);
    pass = false;
}

if (pass) {
    console.log("PASS: All import logic checks passed.");
} else {
    console.error("FAIL: Some checks failed.");
    process.exit(1);
}
