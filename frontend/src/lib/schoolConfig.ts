// Centralized school metadata; update here to reflect everywhere.
// Default (fallback) school configuration; runtime overrides are fetched from server
export const defaultSchoolConfig = {
  name: 'GLORIOUS PUBLIC SCHOOL',
  addressLine: 'Jamoura (Sarkhadi), Distt. LALITPUR (U.P)',
  phone: '+91-0000-000000',
  session: '2025-2026',
  logoUrl: '/logo.png'
};

export type SchoolConfig = typeof defaultSchoolConfig & { updatedAt?: string | null };

// A mutable singleton that components can read; updated by useSchoolConfig hook.
// Attempt hydrate from localStorage first (helps when session/cookies cleared but user expects last seen branding)
function loadCached(): Partial<SchoolConfig> {
  try {
    const raw = localStorage.getItem('schoolConfig');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export let schoolConfig: SchoolConfig = { ...defaultSchoolConfig, ...loadCached() };

export function setSchoolConfig(cfg: Partial<SchoolConfig>) {
  schoolConfig = { ...schoolConfig, ...cfg };
  try {
    localStorage.setItem('schoolConfig', JSON.stringify(schoolConfig));
  } catch {}
}

// Deprecated: client-side receipt serial generation removed. Server now authoritative.
