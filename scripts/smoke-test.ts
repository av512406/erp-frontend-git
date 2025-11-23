// Minimal smoke test for backend health
// Usage: npx tsx scripts/smoke-test.ts (ensure server running locally)

const base = process.env.SMOKE_BASE || 'http://localhost:5000';

async function run() {
  const results: Record<string, any> = {};
  try {
    const r = await fetch(base + '/api/health');
    results.healthStatus = r.status;
    results.healthJson = await r.json().catch(() => null);
  } catch (e: any) {
    results.healthError = e?.message || String(e);
  }

  // Derive pass/fail
  const pass = results.healthStatus === 200 && results.healthJson?.ok === true;
  if (pass) {
    console.log('SMOKE PASS', JSON.stringify(results));
    process.exit(0);
  } else {
    console.error('SMOKE FAIL', JSON.stringify(results));
    process.exit(1);
  }
}

run();
