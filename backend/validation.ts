import { z, ZodError } from 'zod';

// Generic middleware factory to validate req.body using a Zod schema.
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: any, res: any, next: any) => {
    try {
      const parsed = schema.parse(req.body);
      req.validated = parsed;
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ message: 'validation', issues: e.format() });
      }
      return res.status(500).json({ message: 'validation failed' });
    }
  };
}

// Basic string sanitization: strips control characters, collapses whitespace, and neutralizes angle brackets.
export function sanitizeString(input: string | null | undefined) {
  if (input == null) return input;
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // remove control chars excluding \n, \r, \t
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Apply sanitizeString recursively to an object (only string leaves).
export function sanitizeObjectStrings<T extends Record<string, any>>(obj: T): T {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (typeof v === 'string') out[k] = sanitizeString(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = sanitizeObjectStrings(v);
    else if (Array.isArray(v)) out[k] = v.map(it => (typeof it === 'string' ? sanitizeString(it) : it));
    else out[k] = v;
  }
  return out;
}
