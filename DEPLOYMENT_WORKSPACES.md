# School ERP Deployment (Workspaces Edition)

Concise guide for deploying the decoupled setup: frontend on GitHub Pages, backend on AWS, using Drizzle migrations.

---
## 1. Overview
Packages:
- `@erp/frontend` (React/Vite static build)
- `@erp/backend` (Express + Postgres API)
- `@erp/shared` (Schemas & types)

Frontend served as static assets (GitHub Pages). Backend deployed to AWS (EC2 / ECS / Elastic Beanstalk / Fargate) with PostgreSQL (RDS / Neon / Supabase).

---
## 2. Environment Variables
Backend `.env` (examples):
```
DATABASE_URL=postgres://user:pass@host:5432/db
PORT=3000
NODE_ENV=production
FRONTEND_ORIGIN=https://USERNAME.github.io
JWT_SECRET=change_me_immediately
```
Frontend build-time `.env`:
```
VITE_API_BASE_URL=https://api.school.example
GH_PAGES_BASE=/REPO_NAME/
```
Ensure CORS origin matches your Pages URL (no trailing slash). Set `GH_PAGES_BASE` only if hosted at `/REPO_NAME/`.

---
## 3. Migrations (Drizzle)
Generate after schema changes:
```
npx drizzle-kit generate --config ./drizzle.config.ts
```
Review `migrations/` SQL, commit, then push:
```
npx drizzle-kit push --config ./drizzle.config.ts
```
Never rely on `ensureTables` in production for structural evolution—transition to pure migrations. Keep a minimal bootstrap only for idempotent sequences/indexes if needed.

---
## 4. Local Development
Install workspace deps:
```
npm install
```
Run backend:
```
npm run dev:backend
```
Run frontend:
```
npm run dev:frontend
```
(For now server code still lives at `server/`; scripts reference it directly.)

Build all:
```
npm run build
```
Artifacts:
- Backend: `backend/dist/index.js`
- Frontend: `dist/public/` (monorepo root build) or `frontend/dist/` when building from within the app

---
## 5. AWS Backend Deployment (EC2 Example)
SSH into instance, clone repo, then:
```
export DATABASE_URL=postgres://...
export FRONTEND_ORIGIN=https://USERNAME.github.io
export JWT_SECRET=super_secure
npm install --production
npm run build --workspace @erp/shared
npm run build --workspace @erp/backend
node backend/dist/index.js
```
Use systemd or a process manager (PM2) for resilience.

### Reverse Proxy (Nginx snippet)
```
server {
  listen 80;
  server_name api.school.example;
  location /api/ { proxy_pass http://127.0.0.1:3000/api/; }
}
```
Add TLS via Certbot:
```
sudo certbot --nginx -d api.school.example
```

---
## 6. GitHub Pages Frontend Deployment
Workflow builds with:
```
GH_PAGES_BASE=/REPO_NAME/ VITE_API_BASE_URL=https://api.school.example npm run build --workspace @erp/frontend
```
Pages workflow publishes the build directory artifact. Confirm API calls succeed (CORS + correct base URLs).

---
## 7. Health & Verification
After deploy:
- Hit `/api/health` (add if missing) to confirm DB connectivity.
- Test authentication flow.
- Import a small student CSV, list students.
- Create fee transaction, verify receipt serial consistency.

Smoke test script idea:
```
curl -s https://api.school.example/api/students | jq '.[0]'
```

---
## 8. Backup & Rollback
- Daily `pg_dump` to S3 (encrypt if possible).
- Keep last two backend image/builds.
- Rollback = re-deploy prior commit + run migrations only if forward-compatible.

---
## 9. Next Hardening Steps
- (done) Code now lives under `backend/` and `frontend/` folders.
- Docker multi-stage builds.
- Add pagination endpoints.
- Structured logging & metrics.
- CI job: typecheck + migrations drift detection.

---
## 10. Minimal Command Reference
```
# Generate & apply migrations
npx drizzle-kit generate --config drizzle.config.ts
npx drizzle-kit push --config drizzle.config.ts

# Workspace builds
npm run build

# Dev servers
npm run dev:backend
npm run dev:frontend
```

---
## 11. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on static assets in Pages | Missing base path | Set `GH_PAGES_BASE` during build |
| CORS blocked | FRONTEND_ORIGIN mismatch | Adjust env & restart backend |
| Migrations not applied | Skipped push | Run `drizzle-kit push` |
| Receipt serial undefined | Column/sequence absent | Re-run migration or bootstrap sequence |

---
*This doc complements `DEPLOYMENT.md`; keep both until legacy steps are fully retired.*
