# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TicNexus is a multi-tenant franchise management platform built with Next.js 15 (App Router), PostgreSQL, Prisma ORM, Better-Auth, and shadcn/ui + Tailwind CSS. It is deployed via Docker Compose with a reverse proxy handling TLS termination.

---

## Development Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript type check

npm run format       # Format all files with Prettier
npm run format:check # Check formatting without writing

npm run test         # Run Vitest (single pass)
npm run test:watch   # Run Vitest in watch mode
npm run test:coverage # Run Vitest with coverage report

npm run db:generate          # Regenerate Prisma client after schema changes
npm run db:migrate:dev       # Create and apply a new migration (dev only)
npm run db:migrate:deploy    # Apply pending migrations (production/CI)
npm run db:push              # Push schema to DB without migration files (prototyping only)
npm run db:studio            # Open Prisma Studio GUI
npm run db:seed              # Seed the DB with test users, franchises, and locations
```

**Local environment:** Copy `.env.example` to `.env` and fill in all values. Run `docker compose up -d` to start PostgreSQL (the `db` service only). The app can then be run locally with `npm run dev` pointing at the Dockerized database. The `DATABASE_URL` in `.env` must use `localhost` as the host when running the app outside Docker.

**First-run setup:** The admin account (`admin@ticnexus.com` / `Admin1234!`) is created automatically by `prisma/init-admin.ts` on every container startup. No manual setup step is required.

---

## Pre-Commit Checklist

Before committing, verify all four categories below. If issues are found in any category, **stop and discuss the findings with the user before proceeding.**

### 1. Logic

- Confirm RBAC permission checks use `hasPermission()` from [src/lib/permissions.ts](src/lib/permissions.ts) and that scope-limiting queries use helpers from [src/lib/scope.ts](src/lib/scope.ts).
- Confirm every mutation API route calls `createAuditLog()`.
- Confirm invitation expiry, soft-delete (`deletedAt`), and role hierarchy logic behave correctly for all affected roles.

### 2. Code Efficiency

- Check for N+1 query patterns — prefer batched Prisma queries with `in` filters over per-row lookups.
- Avoid fetching more columns than needed; use `select` on Prisma queries.
- Scope-narrowing helpers in [src/lib/scope.ts](src/lib/scope.ts) are called on every request; keep them lean.

### 3. NPM Tests

All three must pass with zero errors:

```bash
npm run lint
npx tsc --noEmit
npm run test
```

Run `npm run format:check` to verify formatting is clean before committing. Use `npm run format` to fix any issues.

### 4. Prisma Tests

- If the schema changed: run `npm run db:migrate:dev` to generate a migration and verify it applies cleanly.
- Run `npm run db:seed` and confirm output shows no errors.
- Open Prisma Studio (`npm run db:studio`) and spot-check affected tables if the schema or seed logic changed.

---

## Branching Convention

**Every new sidebar navigation module gets its own branch.** Create a branch named after the module before starting work (e.g. `feature/work-orders`, `feature/reporting`). Bug fixes and changes to existing modules can be committed on the current working branch.

---

## UI / Mobile Requirements

**All GUI elements must be mobile-phone friendly.** Design components mobile-first:

- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) with the base style targeting mobile viewports.
- The dashboard layout uses `md:pl-64` for the sidebar offset — components inside `<main>` must not assume that offset is absent on mobile.
- Prefer stacking layouts on small screens; avoid horizontal overflow.
- Touch targets (buttons, links, form controls) must be at least 44×44 px.
- Test any new UI at **375px viewport width** (iPhone SE baseline) before marking a task done.

---

## Code Style

Formatting is enforced by Prettier (`.prettierrc`). Key settings: no semicolons, double quotes, 2-space indent, 100-char print width, trailing commas where valid in ES5. Run `npm run format` before committing. ESLint is configured with `eslint-config-prettier` so the two tools never conflict.

Test files live alongside source in `src/**/__tests__/` and follow the `*.test.ts` / `*.test.tsx` naming convention. Vitest globals are enabled — no need to import `describe`, `it`, or `expect`.

---

## Architecture

### Role Hierarchy & Permissions

Five roles in descending rank: `ADMIN → FRANCHISE_MANAGER → SUPERVISOR → TECHNICIAN → STORE_USER`.

Permissions are declared as a static lookup table in [src/lib/permissions.ts](src/lib/permissions.ts). Use `hasPermission(role, permission)` for capability checks and `canCreateRole(actorRole, targetRole)` for invitation gating. **Never inline role comparisons in route handlers** — always go through this module.

### Data Scoping

Roles have visibility scopes enforced at the query level:

- **ADMIN** — sees all data globally.
- **FRANCHISE_MANAGER** — sees only franchises and locations assigned via `UserFranchise`.
- **SUPERVISOR / TECHNICIAN / STORE_USER** — sees only locations assigned via `UserLocation`.

Async scope helpers live in [src/lib/scope.ts](src/lib/scope.ts) (`getFranchiseMgrFranchiseIds`, `getSupervisorLocationIds`, etc.) and are used by API routes to build Prisma `where` filters. Never return data beyond the actor's scope.

### Authentication (Better-Auth)

Auth is handled by better-auth mounted at `/api/auth/[...all]`. Configuration is in [src/lib/auth.ts](src/lib/auth.ts) — it extends the default User model with `firstName`, `lastName`, `role`, `deletedAt`, and `createdById` via `additionalFields`.

The middleware ([src/middleware.ts](src/middleware.ts)) guards all routes by checking the `better-auth.session_token` cookie. Public routes/prefixes are whitelisted there — add new public routes to `PUBLIC_ROUTES` or `PUBLIC_PREFIXES`.

Session retrieval helpers are in [src/lib/session.ts](src/lib/session.ts):

- `getApiSession(request.headers)` — for API route handlers.
- `requireAuth()` / `requireRole(roles)` — for Server Components; redirect on failure.

The `FullSession` type in session.ts manually augments Better-Auth's inferred type to include custom fields, since `$Infer.Session.user` omits `additionalFields` at the TypeScript level.

### API Route Pattern

Every protected API route follows this order:

1. `getApiSession` → 401 if no session.
2. `hasPermission` / `canCreateRole` → 403 if insufficient role.
3. Scope check via [src/lib/scope.ts](src/lib/scope.ts) → 403 if out of scope.
4. Zod schema validation of the request body → 400 on failure.
5. Prisma mutation.
6. `createAuditLog()` from [src/lib/audit.ts](src/lib/audit.ts).

### Audit Logging

All create/update/delete/invite/deactivate operations write an `AuditLog` row. Always call `createAuditLog()` after successful mutations. The `entityType` is a lowercase string matching the table name (e.g. `"franchise"`, `"user"`, `"invitation"`).

### Email

Transactional email uses Nodemailer + Gmail App Passwords ([src/lib/email.ts](src/lib/email.ts)). Invitation acceptance and password reset emails are triggered from API routes, not client code.

### UI Components

- Base primitives live in [src/components/ui/](src/components/ui/) — shadcn/ui components, do not modify directly.
- Feature components live in [src/components/{users,franchises,locations}/](src/components/).
- Client components fetch data from the Next.js API routes via `fetch`; they are not Server Components.

### Database Schema Key Points

- Users are soft-deleted (`deletedAt` nullable). All queries must filter `deletedAt: null` for active records.
- `UserFranchise` and `UserLocation` are the many-to-many join tables for role-scoped assignments.
- `Invitation` tokens expire in 48 hours; `acceptedAt` is set on acceptance.
- Prisma migrations live in [prisma/migrations/](prisma/migrations/) and run automatically on container start via `migrate deploy`.

---

## New Module Architecture Notes

When a new sidebar navigation module is added, create a new branch (see Branching Convention above) and append a section below documenting:

- **Purpose** — what the module does and which roles interact with it.
- **Data model** — new or modified Prisma models/relations.
- **Permissions** — new permission strings added to [src/lib/permissions.ts](src/lib/permissions.ts).
- **API routes** — endpoints added under `src/app/api/`.
- **UI components** — new component files and where they appear in the dashboard.
- **Scope rules** — how data visibility is restricted by role for this module.

_No additional modules have been added beyond the initial user/franchise/location system documented above._
