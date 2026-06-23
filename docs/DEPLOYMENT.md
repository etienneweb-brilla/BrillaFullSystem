# Deploying Brilla Operations System (going live)

The local version uses a simple file database (SQLite) so you can run it with no
accounts. To let staff use it from their phones anywhere, you move to a proper
PostgreSQL database and host the app online. This guide explains the options at a
high level — you do **not** need to do this until you're ready.

> You don't have to decide now. When the time comes, the easiest path is
> **Option A (Vercel + Neon)**. It has a free tier to start.

---

## Step 0 — switch the database to PostgreSQL

1. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your PostgreSQL connection string (your host gives you this).
3. Run the migration against the new database:
   ```
   npx prisma migrate deploy
   npm run db:seed   # optional: creates the starter data + admin login
   ```

The schema was written to be PostgreSQL-compatible, so nothing else needs to change.

---

## Step 1 — set a real secret

In production set a long random `AUTH_SECRET` (used to keep logins secure). Generate one:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Put the result in your host's environment variables as `AUTH_SECRET`.

---

## Hosting options

### Option A — Vercel + Neon (easiest, recommended)
- **Neon** (neon.tech) gives you a free PostgreSQL database. Copy its connection
  string into `DATABASE_URL`.
- **Vercel** (vercel.com) hosts the app. Connect your GitHub repo, add the
  `DATABASE_URL` and `AUTH_SECRET` environment variables, and deploy.
- Note: uploaded photos currently save to local disk. On Vercel you'll want to
  switch file storage to a service like Vercel Blob, S3, or Cloudflare R2
  (the upload code lives in `src/lib/uploads.ts` — only that file changes).

### Option B — Your own server (VPS) with Docker
- A `docker-compose.yml` is included that runs PostgreSQL for you.
- On a server (e.g. DigitalOcean, Hetzner), install Docker, then:
  ```
  docker compose up -d        # starts PostgreSQL
  npm install
  npx prisma migrate deploy
  npm run build
  npm run start               # serves the app on port 3000
  ```
- Put a reverse proxy (Nginx/Caddy) in front for HTTPS and your domain name.
- Uploaded photos persist on the server's disk (mount a volume for `public/uploads`).

---

## What changes between local and production

| Thing            | Local (now)            | Production                          |
|------------------|------------------------|-------------------------------------|
| Database         | SQLite file            | PostgreSQL                          |
| File uploads     | `public/uploads` folder| Object storage (S3/Blob/R2) or disk |
| `AUTH_SECRET`    | dev placeholder        | long random secret                  |
| Web address      | localhost:3000         | your domain                         |

---

## Features intentionally left for later (Phase 2 / 3)

This is the MVP Phase 1 foundation. The database and architecture already support
adding these without rework:

- **Phase 2:** Laundry module (manifests, batches, return verification), Supplier
  management, Driver routes, full Issue management.
- **Phase 3:** Advanced reports & profit dashboards, Inventory, Quality Control
  flows, Recurring work orders, the visual Automation builder, payroll period
  locking.
- **Later:** Online payments (Stripe), SMS/WhatsApp/email notifications, client
  portal, AI features.
