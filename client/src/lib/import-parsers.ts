export const formatCsvDate = (value: string | undefined | null): string => {
    if (!value) return '';
    // If already YYYY-MM-DD just return
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // If ISO timestamp, take first 10 chars
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
    // Try Date parse fallback
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return value; // leave as-is (will surface for correction)
};

// Fix: Properly cast numbers/booleans to string
export const normalize = (val: any) => (val === null || val === undefined) ? '' : String(val).trim();

// Fix: Strip currency and non-numeric chars
export const normalizeNumberString = (val: any) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[^0-9.\-]/g, '');
};

// Fix: Normalize to alphanumeric only for robust matching
export const transformHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export const excelSerialToDate = (num: number) => {
    if (!isFinite(num) || num <= 0) return null;
    const epoch = new Date(Date.UTC(1899, 11, 30)); // Excel base
    const ms = epoch.getTime() + Math.round(num) * 24 * 60 * 60 * 1000;
    return new Date(ms);
};

export const toYMD = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const normalizeDate = (raw: any): string => {
    // Fix: Allow invalid strings to return empty instead of echoing back
    const v = normalize(raw);
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);

    const asNum = Number(String(v).replace(/\s+/g, ''));
    if (!Number.isNaN(asNum) && isFinite(asNum) && asNum > 59 && asNum < 60000) {
        const d = excelSerialToDate(asNum);
        if (d) return toYMD(d);
    }

    const dmy = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dmy) {
        let p1 = parseInt(dmy[1], 10);
        let p2 = parseInt(dmy[2], 10);
        let p3 = parseInt(dmy[3], 10);
        let day: number, month: number, year: number;
        year = p3 < 100 ? 2000 + p3 : p3;
        if (p1 > 12) {
            day = p1; month = p2;
        } else if (p2 > 12) {
            day = p2; month = p1;
        } else {
            day = p1; month = p2;
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    const parsed = new Date(v);
    if (!isNaN(parsed.getTime())) return toYMD(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));

    return ''; // Fix: Return empty string on failure
};
