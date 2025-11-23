import { pool, ensureTables, genId, genTransactionId } from './db.js';

// Reset (truncate) all application tables. Optionally seed with sample data when --sample is passed.
// Usage:
//   npm run reset:db          -> empty schema only
//   npm run reset:db -- --sample  -> empty schema then insert sample subjects, students, grades, fee transactions

async function truncateAll() {
  // Order matters due to foreign keys; truncate child tables first.
  await pool.query('TRUNCATE fee_transactions, grades, class_subjects, subjects, students RESTART IDENTITY CASCADE');
}

async function seedSample() {
  const subjects = [
    { code: 'MATH', name: 'Mathematics' },
    { code: 'SCI', name: 'Science' },
    { code: 'ENG', name: 'English' },
  ];
  const subjectIdByCode: Record<string, string> = {};
  for (const s of subjects) {
    const id = genId();
    await pool.query('INSERT INTO subjects (id, code, name) VALUES ($1,$2,$3)', [id, s.code, s.name]);
    subjectIdByCode[s.code] = id;
  }

  const students = [
    { admissionNumber: 'STU001', name: 'John Doe', dob: '2014-06-15', adm: '2024-04-10', yearlyFee: 20000, grade: '5', section: 'A' },
    { admissionNumber: 'STU002', name: 'Alice Williams', dob: '2013-02-20', adm: '2024-04-10', yearlyFee: 21000, grade: '6', section: 'A' },
    { admissionNumber: 'STU003', name: 'Bob Johnson', dob: '2012-11-05', adm: '2024-04-10', yearlyFee: 19000, grade: '7', section: 'B' },
  ];
  const studentIdByAdm: Record<string, string> = {};
  for (const st of students) {
    const id = genId();
    await pool.query(
      `INSERT INTO students (id, admission_number, name, date_of_birth, admission_date, yearly_fee_amount, grade, section)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, st.admissionNumber, st.name, st.dob, st.adm, st.yearlyFee, st.grade, st.section]
    );
    studentIdByAdm[st.admissionNumber] = id;
  }

  // Seed grades (Term1) for each student & subject
  const gradeEntries: { studentAdm: string; subject: string; marks: number }[] = [
    { studentAdm: 'STU001', subject: 'MATH', marks: 88 },
    { studentAdm: 'STU001', subject: 'ENG', marks: 92 },
    { studentAdm: 'STU002', subject: 'MATH', marks: 78 },
    { studentAdm: 'STU002', subject: 'SCI', marks: 85 },
    { studentAdm: 'STU003', subject: 'ENG', marks: 74 },
    { studentAdm: 'STU003', subject: 'SCI', marks: 80 },
  ];
  for (const g of gradeEntries) {
    const id = genId();
    await pool.query(
      'INSERT INTO grades (id, student_id, subject, marks, term) VALUES ($1,$2,$3,$4,$5)',
      [id, studentIdByAdm[g.studentAdm], g.subject, g.marks, 'Term1']
    );
  }

  // Seed a few fee transactions
  const feeEntries: { studentAdm: string; amount: number; date: string; mode?: string; remarks?: string }[] = [
    { studentAdm: 'STU001', amount: 5000, date: '2025-04-15', mode: 'cash', remarks: 'First installment' },
    { studentAdm: 'STU002', amount: 6000, date: '2025-04-16', mode: 'upi', remarks: 'First installment' },
    { studentAdm: 'STU003', amount: 5500, date: '2025-04-17', mode: 'card', remarks: 'First installment' },
  ];
  for (const f of feeEntries) {
    const id = genId();
    const txn = genTransactionId();
    await pool.query(
      `INSERT INTO fee_transactions (id, student_id, transaction_id, amount, payment_date, payment_mode, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, studentIdByAdm[f.studentAdm], txn, f.amount, f.date, f.mode, f.remarks]
    );
  }
}

async function count(table: string) {
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM ${table}`);
  return rows[0].c as number;
}

async function main() {
  const sample = process.argv.includes('--sample');
  await ensureTables();
  await truncateAll();
  if (sample) {
    await seedSample();
  }
  const tables = ['students', 'subjects', 'class_subjects', 'grades', 'fee_transactions'];
  const summary: Record<string, number> = {};
  for (const t of tables) summary[t] = await count(t);
  console.log('\n=== Database Reset Complete ===');
  console.table(summary);
  console.log(`Seeded sample data: ${sample ? 'YES' : 'NO'}`);
  process.exit(0);
}

main().catch(e => {
  console.error('Reset failed:', e);
  process.exit(1);
});
