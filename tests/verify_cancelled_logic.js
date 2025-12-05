
// Verification Script for Cancelled Transaction Logic

// Mock Data
const student = {
    id: "student-1",
    name: "Test Student",
    yearlyFeeAmount: "10000",
    previousYearDue: "5000"
};

const transactions = [];

// Helper to calculate pending fees (Logic from App.tsx)
function calculatePendingFees(students, transactions) {
    const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0) + (parseFloat(st.previousYearDue || '0') || 0), 0);
    const paid = transactions
        .filter(t => t.status !== 'cancelled')
        .reduce((s, t) => s + (t.amount || 0), 0);
    return Math.max(Math.round(totalYearly - paid), 0);
}

console.log("--- Starting Cancelled Transaction Logic Verification ---");

// Step 1: Initial State
console.log("\nStep 1: Initial State (No payments)");
let pending = calculatePendingFees([student], transactions);
let expectedPending = 15000;
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 1 Failed");

// Step 2: Valid Payment
console.log("\nStep 2: Valid Payment of 5000");
transactions.push({ id: "tx-1", studentId: "student-1", amount: 5000, status: "active" });
pending = calculatePendingFees([student], transactions);
expectedPending = 10000;
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 2 Failed");

// Step 3: Cancelled Payment
console.log("\nStep 3: Cancelled Payment of 5000 (should be ignored)");
transactions.push({ id: "tx-2", studentId: "student-1", amount: 5000, status: "cancelled" });
pending = calculatePendingFees([student], transactions);
expectedPending = 10000; // Should remain same as Step 2
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 3 Failed");

// Step 4: Cancel the first payment
console.log("\nStep 4: Cancel the first payment (tx-1)");
const tx1 = transactions.find(t => t.id === "tx-1");
tx1.status = "cancelled";
pending = calculatePendingFees([student], transactions);
expectedPending = 15000; // Should return to initial
console.log(`Pending Fees: ${pending} (Expected: ${expectedPending})`);
if (pending !== expectedPending) throw new Error("Step 4 Failed");

console.log("\n--- Cancelled Transaction Logic Verification Passed ---");
