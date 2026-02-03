
import { normalize, normalizeDate, normalizeNumberString, transformHeader, formatCsvDate } from '../client/src/lib/import-parsers';
import assert from 'assert';

console.log("Running Unit Tests for import-parsers.ts...");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
    } catch (e: any) {
        console.error(`❌ FAIL: ${name}`);
        console.error(e.message);
        failed++;
    }
}

// 1. Test transformHeader
test('transformHeader: Normalizes common headers', () => {
    assert.strictEqual(transformHeader('Admission Number'), 'admissionnumber'); // "admission" + "number" -> admissionnumber
    assert.strictEqual(transformHeader('ADMISSION NO'), 'admissionno');
    assert.strictEqual(transformHeader('Date of Birth'), 'dateofbirth');
    assert.strictEqual(transformHeader('DOB'), 'dob');
    assert.strictEqual(transformHeader('Father Name'), 'fathername');
    assert.strictEqual(transformHeader("Father's Name"), 'fathersname');
    assert.strictEqual(transformHeader('Yearly Fee Amount'), 'yearlyfeeamount');
    assert.strictEqual(transformHeader('yearly_fee'), 'yearlyfee');
    assert.strictEqual(transformHeader(' Class '), 'class');
    assert.strictEqual(transformHeader('Unknown Header'), 'unknownheader');
});

// 2. Test normalizeDate
test('normalizeDate: Handles various date formats', () => {
    // YYYY-MM-DD
    assert.strictEqual(normalizeDate('2023-05-15'), '2023-05-15');
    // DD-MM-YYYY
    assert.strictEqual(normalizeDate('15-05-2023'), '2023-05-15');
    // DD/MM/YYYY
    assert.strictEqual(normalizeDate('15/05/2023'), '2023-05-15');
    // D/M/YYYY (Single digits)
    assert.strictEqual(normalizeDate('5/5/2023'), '2023-05-05');
    // Check invalid
    assert.strictEqual(normalizeDate('invalid-date'), '');
    assert.strictEqual(normalizeDate(''), '');
    // Excel Serial Date (e.g. 45000 approx) - logic might not handle this yet, let's see current implementation
    // If implementation doesn't support it, this test will fail and I'll know to fix it or remove it.
});

// 3. Test normalizeNumberString
test('normalizeNumberString: Cleans currency and commas', () => {
    assert.strictEqual(normalizeNumberString('1,000'), '1000');
    assert.strictEqual(normalizeNumberString('₹ 5,000.00'), '5000.00');
    assert.strictEqual(normalizeNumberString('  250  '), '250');
    assert.strictEqual(normalizeNumberString(''), '');
    assert.strictEqual(normalizeNumberString(null), '');
});

// 4. Test normalize (General String)
test('normalize: Trims and handles nulls', () => {
    assert.strictEqual(normalize('  Hello World  '), 'Hello World');
    assert.strictEqual(normalize(null), '');
    assert.strictEqual(normalize(undefined), '');
    assert.strictEqual(normalize(123), '123');
});

// 5. Test formatCsvDate
test('formatCsvDate: Formats for CSV export', () => {
    // Should return YYYY-MM-DD if input is valid ISO
    assert.strictEqual(formatCsvDate('2023-01-01T00:00:00.000Z'), '2023-01-01');
    assert.strictEqual(formatCsvDate('2023-05-20'), '2023-05-20');
    // Empty/Invalid
    assert.strictEqual(formatCsvDate(''), '');
});

console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
