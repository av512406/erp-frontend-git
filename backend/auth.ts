import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './db.js';
import { RegisterUserInput, registerUserSchema, loginSchema, LoginInput } from '@erp/shared';
import { z, ZodError } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8h

export interface AuthTokenPayload {
  sub: string; // user id
  role: string;
  email: string;
  iat: number;
  exp: number;
}

export async function hashPassword(pw: string) {
  const rounds = 10;
  return bcrypt.hash(pw, rounds);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email } as AuthTokenPayload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'missing auth header' });
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'invalid auth header format' });
  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET) as AuthTokenPayload;
    (req as any).auth = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'invalid or expired token' });
  }
}

export function requireRole(roles: string[]) {
  return function (req: any, res: any, next: any) {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'unauthenticated' });
    if (!roles.includes(auth.role)) return res.status(403).json({ message: 'forbidden' });
    next();
  }
}

// Register user (admin only or bootstrap if no admin yet)
export async function handleRegister(body: any) {
  const parsed: RegisterUserInput = registerUserSchema.parse(body);
  const existing = await pool.query('SELECT id FROM users WHERE email=$1', [parsed.email]);
  if ((existing.rowCount ?? 0) > 0) {
    return { status: 409, payload: { message: 'email exists' } };
  }
  const idRes = await pool.query('SELECT gen_random_uuid() as id');
  const id = idRes.rows[0].id;
  const role = parsed.role || 'teacher';
  const hash = await hashPassword(parsed.password);
  await pool.query('INSERT INTO users (id, email, password_hash, role, name) VALUES ($1,$2,$3,$4,$5)', [id, parsed.email, hash, role, parsed.name || null]);
  const token = signToken({ id, role, email: parsed.email });
  return { status: 201, payload: { token, user: { id, email: parsed.email, role, name: parsed.name || null } } };
}

export async function handleLogin(body: any) {
  const parsed: LoginInput = loginSchema.parse(body);
  const q = await pool.query('SELECT id, email, password_hash, role, name FROM users WHERE email=$1', [parsed.email]);
  if ((q.rowCount ?? 0) === 0) return { status: 401, payload: { message: 'invalid credentials' } };
  const user = q.rows[0];
  const ok = await verifyPassword(parsed.password, user.password_hash);
  if (!ok) return { status: 401, payload: { message: 'invalid credentials' } };
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  return { status: 200, payload: { token, user: { id: user.id, email: user.email, role: user.role, name: user.name } } };
}

export function currentUserFromReq(req: any) {
  return (req as any).auth || null;
}

// Helper to safely parse body using a Zod schema
export function safeParse<T extends z.ZodTypeAny>(schema: T, data: any) {
  try {
    return { success: true, data: schema.parse(data) } as const;
  } catch (e) {
    if (e instanceof ZodError) return { success: false, issues: e.format() } as const;
    return { success: false, issues: { _error: 'unknown' } } as const;
  }
}
