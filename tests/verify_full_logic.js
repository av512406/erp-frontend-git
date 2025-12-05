
// Comprehensive Verification Script for Previous Year Due

// Mock Data
const student = {
    id: "student-1",
    name: "Test Student",
    yearlyFeeAmount: "10000",
    previousYearDue: "5000" // Key field
};

const transactions = [];

// Helper to calculate pending fees (Logic from App.tsx)
function calculatePendingFees(students, transactions) {
    const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0) + (parseFloat(st.previousYearDue || '0') || 0), 0);
    const paid = transactions.reduce((s, t) => s + (t.amount || 0), 0);
    return Math.max(Math.round(totalYearly - paid), 0);
}

// Helper to calculate receipt remaining (Logic from Receipt.tsx)
function calculateReceiptRemaining(student, paidSoFar) {
    const yearly = parseFloat(student.yearlyFeeAmount || '0');
    const prev = parseFloat(student.previousYearDue || '0');
    return (yearly + prev) - paidSoFar;
}

console.log("--- Starting Full Logic Verification ---");

// Step 1: Initial State (No payments)
console.log("\nStep 1: Initial State (No payments)");
let pending = calculatePendingFees([student], transactions);
let expectedPending = 10000 + 5000;
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 1 Failed");

// Step 2: Partial Payment
console.log("\nStep 2: Partial Payment of 2000");
transactions.push({ studentId: "student-1", amount: 2000 });
pending = calculatePendingFees([student], transactions);
expectedPending = 15000 - 2000;
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 2 Failed");

// Step 3: Receipt Calculation
console.log("\nStep 3: Receipt Calculation after 2000 payment");
// In the app, 'paidSoFar' includes the current transaction.
const paidSoFar = 2000;
const remaining = calculateReceiptRemaining(student, paidSoFar);
const expectedRemaining = 15000 - 2000;
console.log(`Receipt Remaining: ${remaining} (Expected: ${expectedRemaining})`);
if (remaining !== expectedRemaining) throw new Error("Step 3 Failed");

// Step 4: Full Payment
console.log("\nStep 4: Full Payment of remaining 13000");
transactions.push({ studentId: "student-1", amount: 13000 });
pending = calculatePendingFees([student], transactions);
expectedPending = 0;
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 4 Failed");

// Step 5: Overpayment
console.log("\nStep 5: Overpayment of 1000");
transactions.push({ studentId: "student-1", amount: 1000 });
pending = calculatePendingFees([student], transactions);
// Dashboard logic clamps to 0
expectedPending = 0;
console.log(`Pending Fees (Clamped): ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 5 Failed");

// Receipt logic allows negative (overpayment)
const totalPaid = 2000 + 13000 + 1000;
const receiptRemaining = calculateReceiptRemaining(student, totalPaid);
const expectedReceiptRemaining = 15000 - 16000;
console.log(`Receipt Remaining (Unclamped): ${receiptRemaining} (Expected: ${expectedReceiptRemaining})`);
if (receiptRemaining !== expectedReceiptRemaining) throw new Error("Step 5 Receipt Failed");

console.log("\n--- All Logic Verification Passed ---");
