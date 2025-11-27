
const normalize = (val) => typeof val === 'string' ? val.trim() : (val || '');
const toYMD = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const normalizeDate = (raw) => {
    const v = normalize(raw);
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);

    const parsed = new Date(v);
    if (!isNaN(parsed.getTime())) return toYMD(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));
    return v;
};

const dateStr = "Thu Jan 01 2015 00:00:00 GMT+0000 (Coordinated Universal Time)";
console.log(`Input: ${dateStr}`);
console.log(`Output: ${normalizeDate(dateStr)}`);
