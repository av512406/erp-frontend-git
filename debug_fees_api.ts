import { pool } from './server/db';
import { formatDateForClient } from './server/routes'; // This might not be exported, I'll copy the logic or just check DB

async function debug() {
    console.log('Debugging Fees API...');
    const client = await pool.connect();
    try {
        // Insert a test transaction
        const insertRes = await client.query(`
      INSERT INTO fee_transactions (id, student_id, amount, payment_date, payment_mode, remarks, school_id, transaction_id)
      VALUES ('debug-id-123', (SELECT id FROM students LIMIT 1), 100, '2025-12-04', 'cash', 'debug', (SELECT id FROM schools LIMIT 1), 'DEBUG-001')
      RETURNING payment_date
    `);
        const d = insertRes.rows[0].payment_date;
        console.log('Inserted Date Object:', d);
        console.log('Inserted Date toString:', d.toString());
        console.log('Inserted Date toISOString:', d.toISOString());
        console.log('Inserted Date Local YMD:', d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());

        // Clean up
        await client.query("DELETE FROM fee_transactions WHERE transaction_id = 'DEBUG-001'");

        const res = await client.query('SELECT payment_date FROM fee_transactions ORDER BY created_at DESC LIMIT 5');
        console.log('Raw DB payment_dates:', res.rows.map(r => r.payment_date));

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        console.log('Frontend "today":', today);

        // Simulate formatDateForClient
        const formatted = res.rows.map(r => {
            const v = r.payment_date;
            if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
            return String(v);
        });
        console.log('Formatted dates:', formatted);

        const match = formatted.filter(d => d === today);
        console.log(`Matches for today (${today}):`, match.length);

    } catch (e) {
        console.error('Debug failed:', e);
    } finally {
        client.release();
        process.exit(0);
    }
}

debug();
