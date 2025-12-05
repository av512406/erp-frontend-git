
// Comprehensive Verification for Previous Year Due Scenarios

const student = {
    id: "student-1",
    name: "Test Student",
    yearlyFeeAmount: "10000",
    previousYearDue: "5000" // The focus of this test
};

let transactions = [];

// Logic from App.tsx (The Source of Truth)
function calculatePendingFees(students, transactions) {
    const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0) + (parseFloat(st.previousYearDue || '0') || 0), 0);
    const paid = transactions
        .filter(t => t.status !== 'cancelled')
        .reduce((s, t) => s + (t.amount || 0), 0);
    return Math.max(Math.round(totalYearly - paid), 0);
}

console.log("--- Comprehensive Previous Year Due Verification ---");
console.log(`Student Yearly Fee: ${student.yearlyFeeAmount}`);
console.log(`Student Previous Due: ${student.previousYearDue}`);
console.log(`Total Expected Due: 15000`);

// Test Case 1: Initial State
console.log("\nTest Case 1: Initial State (No payments)");
let pending = calculatePendingFees([student], transactions);
if (pending === 15000) console.log("PASS: Pending is 15000 (10k + 5k)");
else console.error(`FAIL: Pending is ${pending}, expected 15000`);

// Test Case 2: Partial Payment (Covering Previous Due)
console.log("\nTest Case 2: Payment of 5000 (Should cover Previous Due)");
transactions.push({ id: "tx-1", amount: 5000, status: "active" });
pending = calculatePendingFees([student], transactions);
if (pending === 10000) console.log("PASS: Pending is 10000 (Remaining Yearly Fee)");
else console.error(`FAIL: Pending is ${pending}, expected 10000`);

// Test Case 3: Cancelled Transaction
console.log("\nTest Case 3: Cancelled Transaction of 2000 (Should be ignored)");
transactions.push({ id: "tx-2", amount: 2000, status: "cancelled" });
pending = calculatePendingFees([student], transactions);
if (pending === 10000) console.log("PASS: Pending is still 10000 (Cancelled tx ignored)");
else console.error(`FAIL: Pending is ${pending}, expected 10000`);

// Test Case 4: Full Payment
console.log("\nTest Case 4: Payment of 10000 (Clearing remaining balance)");
transactions.push({ id: "tx-3", amount: 10000, status: "active" });
pending = calculatePendingFees([student], transactions);
if (pending === 0) console.log("PASS: Pending is 0 (Fully Paid)");
else console.error(`FAIL: Pending is ${pending}, expected 0`);

// Test Case 5: Overpayment
console.log("\nTest Case 5: Overpayment of 1000");
transactions.push({ id: "tx-4", amount: 1000, status: "active" });
pending = calculatePendingFees([student], transactions);
if (pending === 0) console.log("PASS: Pending stays 0 (Dashboard logic clamps to 0)");
else console.error(`FAIL: Pending is ${pending}, expected 0`);

// Test Case 6: Cancel the Full Payment (tx-3)
console.log("\nTest Case 6: Cancel the 10000 payment (tx-3)");
// Find tx-3 and cancel it
const tx3 = transactions.find(t => t.id === "tx-3");
tx3.status = "cancelled";
// Current active: tx-1 (5000), tx-4 (1000) = 6000 paid. Total due 15000. Pending should be 9000.
pending = calculatePendingFees([student], transactions);
if (pending === 9000) console.log("PASS: Pending is 9000 (15000 - 6000 paid)");
else console.error(`FAIL: Pending is ${pending}, expected 9000`);

console.log("\n--- Verification Complete ---");
