// Centralized school metadata; update here to reflect everywhere.
// Default (fallback) school configuration; runtime overrides are fetched from server
export const defaultSchoolConfig = {
  name: 'School ERP',
  addressLine: 'School Address',
  phone: '+91-0000-000000',
  session: '2025-2026',
  logoUrl: '/logo.png',
  email: 'admin@school.com'
};

export type SchoolConfig = typeof defaultSchoolConfig & { updatedAt?: string | null };

// A mutable singleton that components can read; updated by useSchoolConfig hook.
// Attempt hydrate from localStorage first (helps when session/cookies cleared but user expects last seen branding)
function loadCached(): Partial<SchoolConfig> {
  try {
    const raw = localStorage.getItem('schoolConfig');
    if (raw) return JSON.parse(raw);
  } catch { }
  return {};
}

export let schoolConfig: SchoolConfig = { ...defaultSchoolConfig, ...loadCached() };

export function setSchoolConfig(cfg: Partial<SchoolConfig>) {
  schoolConfig = { ...schoolConfig, ...cfg };
  try {
    localStorage.setItem('schoolConfig', JSON.stringify(schoolConfig));
  } catch { }
}

// Incremental serial number persistence (client side). In a multi-user
// environment this should be server backed; for now we use localStorage.
export function nextReceiptSerial(): number {
  try {
    const key = 'receiptSerial';
    const raw = localStorage.getItem(key);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    // Fallback: random-ish 5 digit number
    return Math.floor(10000 + Math.random() * 90000);
  }
}
