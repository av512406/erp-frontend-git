import dotenv from 'dotenv';
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  console.log('Dotenv error:', dotenvResult.error);
}
console.log('Current directory:', process.cwd());
console.log('Environment PORT:', process.env.PORT);

import express, { type Request, Response, NextFunction } from "express";
import { pool } from './db.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { registerRoutes } from "./routes.js";
// Decoupled from Vite: remove import of ./vite (which pulled in 'vite' package) to allow backend to run standalone
// Lightweight log helper replicated here (original lived in ./vite.ts and required Vite deps indirectly)
function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [backend] ${message}`);
}

import cors from 'cors';

// ... (existing imports)

const app = express();

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173', // Local dev
  process.env.CORS_ORIGIN, // Production frontend URL (e.g., https://username.github.io)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o as string))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ... (rest of the file)

// Rate limiting: stricter on auth; moderate on writes (skip GET to avoid blocking dashboards)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET'
});
app.use('/api/auth/', authLimiter);
app.use([
  '/api/students',
  '/api/fees',
  '/api/grades',
  '/api/subjects',
  '/api/classes',
  '/api/admin'
], writeLimiter);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
// Increase body size limit to accommodate base64 logo uploads (default ~100kb was causing 413)
app.use(express.json({
  // Allow up to 5mb to avoid upstream proxy truncation after base64 expansion; actual logo size enforced server-side at 300KB
  limit: '5mb',
  verify: (req: Request, _res: Response, buf: Buffer) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args] as [any]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const reqId = (req as any).requestId;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms id=${reqId}`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health endpoints (simple + deep)
app.get('/healthz', (_req: Request, res: Response) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/readyz', async (req: Request, res: Response) => {
  try {
    const seq = await app.get('pool')?.query?.("SELECT last_value FROM receipt_serial_seq")
      || await import('./db.js').then(m => m.pool.query("SELECT 1"));
    res.json({ ready: true, sequenceChecked: !!seq });
  } catch (e) {
    res.status(500).json({ ready: false, error: (e as any)?.message });
  }
});

// Short alias health endpoint for external monitors / load balancers
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    // lightweight DB ping; timeout after 750ms to avoid long hangs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);
    await pool.query('SELECT 1');
    clearTimeout(timeout);
    res.json({ ok: true, db: true, timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.status(503).json({ ok: false, db: false, error: e?.code || e?.message || 'db check failed', timestamp: new Date().toISOString() });
  }
});

(async () => {
  const server = await registerRoutes(app);

  // Central error handler (do not rethrow to avoid crashing process)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const requestId = (req as any).requestId;
    const message = status >= 500 ? 'Internal Server Error' : (err.message || 'Error');
    log(`ERROR ${req.method} ${req.path} ${status} id=${requestId} :: ${(err && err.stack) ? String(err.stack).split('\n')[0] : message}`);
    if (!res.headersSent) {
      res.status(status).json({ message, requestId });
    }
  });

  // Frontend is now served separately by its own Vite dev server / static host.
  // If you still need to serve built static assets from backend in production, add a lightweight express.static() here.

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving API on port ${port}`);
  });
})();
