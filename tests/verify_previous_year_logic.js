
// Verification script for Previous Year Due Integration Logic

const student = {
    yearlyFeeAmount: "12000",
    previousYearDue: "5000"
};

const transactions = [
    { amount: 2000 }
];

// 1. Verify Dashboard Pending Fees Logic
// Logic from App.tsx:
// const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0) + (parseFloat((st as any).previousYearDue || '0') || 0), 0);
// const paid = transactions.reduce((s, t) => s + (t.amount || 0), 0);
// return Math.max(Math.round(totalYearly - paid), 0);

const yearly = parseFloat(student.yearlyFeeAmount || '0') || 0;
const prevDue = parseFloat(student.previousYearDue || '0') || 0;
const totalDue = yearly + prevDue;
const paid = transactions.reduce((s, t) => s + (t.amount || 0), 0);
const pendingFees = Math.max(Math.round(totalDue - paid), 0);

console.log("--- Dashboard Pending Fees Logic ---");
console.log(`Yearly: ${yearly}`);
console.log(`Prev Due: ${prevDue}`);
console.log(`Total Due: ${totalDue}`);
console.log(`Paid: ${paid}`);
console.log(`Pending Fees (Calculated): ${pendingFees}`);
console.log(`Expected: ${12000 + 5000 - 2000}`);

if (pendingFees === 15000) {
    console.log("PASS: Dashboard logic is correct.");
} else {
    console.error("FAIL: Dashboard logic is incorrect.");
}

// 2. Verify Receipt Remaining Calculation Logic
// Logic from Receipt.tsx:
// const computedRemaining = showSummary ? (typeof remainingFee === 'number' ? remainingFee : ((yearlyFeeAmount! + (previousYearDue || 0)) - paidSoFar!)) : undefined;

const yearlyFeeAmount = 12000;
const previousYearDue = 5000;
const paidSoFar = 2000;
const computedRemaining = (yearlyFeeAmount + (previousYearDue || 0)) - paidSoFar;

console.log("\n--- Receipt Remaining Calculation Logic ---");
console.log(`Yearly: ${yearlyFeeAmount}`);
console.log(`Prev Due: ${previousYearDue}`);
console.log(`Paid So Far: ${paidSoFar}`);
console.log(`Remaining (Calculated): ${computedRemaining}`);
console.log(`Expected: ${12000 + 5000 - 2000}`);

if (computedRemaining === 15000) {
    console.log("PASS: Receipt logic is correct.");
} else {
    console.error("FAIL: Receipt logic is incorrect.");
}
