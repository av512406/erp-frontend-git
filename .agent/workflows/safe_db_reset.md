---
description: How to safely manually reset the database and ensure a clean state
---

This workflow describes the safe way to completely wipe and reset the database.

# Prerequisite: Stop the app
It is best to stop the app first to prevent it from trying to query the DB while you are wiping it.
```bash
docker stop school_erp_app
```

# Step 1: Wipe the Database
You can use the existing script or a simple SQL command. The safest way that handles permissions is:

```bash
// turbo
npx tsx wipe_db.ts
```
*(Note: If `wipe_db.ts` does not exist, you can create it or just run the SQL manually via `psql` or a GUI tool: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)*

# Step 2: Run Migrations Manually
Before starting the app, force the migrations to run. This ensures the tables exist before the app tries to connect.

```bash
// turbo
npx drizzle-kit migrate
```

# Step 3: Seed Default Data (Optional but Recommended)
If you need the superadmin user:

```bash
npx tsx scripts/seed_defaults.ts
```
*(Or let the app do it on startup)*

# Step 4: Restart the Application
Now that the DB is ready, start the app.

```bash
docker start school_erp_app
```

# Step 5: Restart Nginx (Crucial)
Nginx often keeps looking for the old container instance. Always restart it after an app restart.

```bash
docker restart school_erp_nginx
```

# Summary of One-Liner
If you are in a hurry, you can chain them:

```bash
docker stop school_erp_app && npx tsx wipe_db.ts && npx drizzle-kit migrate && docker start school_erp_app && docker restart school_erp_nginx
```
