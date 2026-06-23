# Brilla Operations System

A **configurable field-service operations platform** for Brilla Services. Any
service — cleaning, laundry, pest control, pool, gardening, maintenance — is
created, priced, assigned, tracked, invoiced and reported through a universal
**Service Builder**. Nothing about specific services is hardcoded.

This repository is **MVP Phase 1 (Foundation)**. See the bottom of this file for
what's included now and what's planned for later phases.

## Quick start

New to running code? Read **[docs/RUNNING.md](docs/RUNNING.md)** — it's written
step by step for non-developers. The short version:

```bash
npm install
npx prisma migrate dev      # create the local database
npm run db:seed             # starter data + demo logins
npm run dev                 # http://localhost:3000
```

Demo logins (from the seed):

| Role    | Email                | Password   |
|---------|----------------------|------------|
| Admin   | admin@brilla.local   | admin123   |
| Cleaner | cleaner@brilla.local | cleaner123 |

## Tech stack

- **Next.js (App Router, TypeScript)** — responsive UI + server logic in one app
- **Prisma ORM** — SQLite locally (zero setup), PostgreSQL-ready for production
- **Tailwind CSS** — responsive admin + large-button mobile staff views
- **Self-hosted auth** — email/password, signed cookie sessions, configurable
  role-based access (no external service or API keys)

## Architecture (the important ideas)

Core hierarchy:

```
Clients → Properties → Work Orders → Service Lines → Tasks
        → Staff Assignments → Payroll → Invoices → Reports
```

Five principles drive the design:

1. **Nothing hardcoded** — categories, roles, statuses, client types, property
   fields, pricing types and checklists are data, configurable in the admin panel.
2. **Service versioning** — editing a service creates a new version; existing work
   orders keep the version they used, so history never changes.
3. **Commission/payroll read the Service Line/Task**, never the Work Order total.
4. **Dynamic fields** — property attributes and service forms use field definitions
   + JSON values, so admins add fields without code changes.
5. **Role-scoped UI** — staff only see their own tasks and the instructions
   relevant to their role.

### Project layout

```
prisma/schema.prisma     all data models
prisma/seed.ts           roles, statuses, settings, demo users + sample service
src/lib/                 auth, db, rbac, pricing engine, payroll engine, audit, settings
src/app/(app)/           admin app (dashboard, services, clients, properties,
                         work orders, staff, invoices, settings)
src/app/(app)/me/        staff mobile dashboard + task completion
src/components/          shared UI (app shell, status badges, page header)
docs/                    RUNNING.md (local) and DEPLOYMENT.md (going live)
```

The pricing engine (`src/lib/pricing.ts`) and payroll engine
(`src/lib/payroll.ts`) are pure functions with unit tests (`npm test`).

## Scripts

```bash
npm run dev          # start in development
npm run build        # production build
npm run start        # run the production build
npm test             # run unit tests (pricing + payroll engines)
npm run typecheck    # TypeScript check
npm run db:migrate   # apply schema changes
npm run db:seed      # seed starter data
npm run db:reset     # wipe + reseed the local database
npm run db:studio    # browse the database in a UI
```

## What's included (Phase 1)

Auth + role-based access · Settings (company, global VAT, configurable lists) ·
Service Builder (all pricing types, form builder, task templates, checklists,
eligibility, versioning, cloning) · Clients · Properties (dynamic attributes,
role-scoped instructions) · Work Orders → Service Lines → Tasks (with eligibility
enforcement and automatic task generation) · Staff profiles (eligibility, payroll
& commission rules) · Role dashboards (admin desktop + staff mobile) · Time
tracking (clock in/out) · Basic invoicing (global VAT, printable PDF, manual
payments) · Audit logging.

## Planned for later (schema-ready)

- **Phase 2:** Laundry (manifests, batches, return verification), Suppliers,
  Driver routes, full Issue management.
- **Phase 3:** Advanced reports & profit dashboards, Inventory, Quality Control,
  Recurring work orders, visual Automation builder, payroll period locking.
- **Later:** Online payments, SMS/WhatsApp/email notifications, client portal, AI.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for going live.
