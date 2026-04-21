# Spacyy — CLAUDE.md

## Project Overview

Spacyy is a **multi-tenant SaaS booking platform** for fitness/wellness businesses (e.g. pilates studios, gyms). Each business (Organization) gets its own subdomain (`slug.spacyy.com`) or a verified custom domain (`book.theirstudio.com`). Clients can browse sessions, make bookings, and manage memberships. Admins/Owners manage spaces, sessions, timetables, clients, and check-ins.

The app is deployed on **Vercel** and is also a **PWA** (via next-pwa).

---

## Repository Structure

```
Spacyy/
├── frontend/          ← Next.js 14 app (App Router)
│   ├── app/           ← Pages and API routes
│   ├── components/    ← Reusable React components
│   ├── lib/           ← Server-side utilities (auth, prisma, tenant)
│   ├── prisma/        ← Prisma schema and migrations
│   ├── scripts/       ← One-off Node.js setup scripts
│   ├── types/         ← NextAuth type augmentations
│   └── public/        ← Static assets + PWA files
└── shared/            ← Shared types, constants, and business logic
    ├── types/         ← TypeScript types (booking, session, space, user, enums)
    ├── lib/           ← Pure utility functions (availability, booking logic)
    └── constants/     ← Shared constants (booking statuses)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL via **Supabase** (connection pooling) |
| ORM | **Prisma 5** (schema at `frontend/prisma/schema.prisma`) |
| Auth | **NextAuth v4** (CredentialsProvider, JWT strategy) |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form + Zod |
| Email | Nodemailer (SMTP via Gmail) |
| QR Codes | qrcode + html5-qrcode |
| Dates | date-fns |
| Deployment | Vercel |
| PWA | next-pwa |

> **Note:** `@supabase/supabase-js` is installed but **not yet in active use** — the database is accessed exclusively via Prisma. Supabase keys in `.env` are placeholders. Do not assume Supabase client-side auth or Supabase RLS is active.

---

## Database & ORM

- **All database access goes through Prisma** — never write raw SQL or use the Supabase JS client for data fetching.
- The Prisma client singleton lives at `frontend/lib/prisma.ts`.
- Schema is at `frontend/prisma/schema.prisma`.
- All IDs are `cuid()` strings, not UUIDs or integers.
- Column naming is `camelCase` in Prisma, which maps to `snake_case` in Postgres.
- Always run `npm run db:generate` after modifying the schema.

### Key Models

| Model | Purpose |
|---|---|
| `Organization` | A tenant (a business using Spacyy). Has `slug` and optional `customDomain`. |
| `User` | A person who can log in. Can belong to multiple organizations. |
| `UserOrganization` | Junction table — assigns a `UserRole` (OWNER, ADMIN, CLIENT) per org. |
| `Client` | An org-specific client record, may or may not be linked to a `User`. |
| `Space` | A bookable resource (mat, seat, table) within an org. |
| `ServiceSession` | A class/service type (e.g. "Yoga Flow"). Has `slots` capacity and `themeColor`. |
| `TimeSlot` | Recurring timetable entry for a `ServiceSession` (dayOfWeek + HH:mm times). |
| `Booking` | A confirmed reservation linking Client → ServiceSession + time. Has `checkedIn` flag. |
| `Invitation` | Token-based email invitation to join an org. |

### Enums

Defined in both Prisma schema AND `shared/types/enums.ts` — keep them in sync:

```ts
enum UserRole   { OWNER, ADMIN, CLIENT }
enum BookingStatus { PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW }
```

---

## Multi-Tenancy

The app resolves the active Organization (tenant) from the request hostname:

- `slug.spacyy.com` → subdomain lookup by `Organization.slug`
- `book.customdomain.com` → custom domain lookup (must have `customDomainVerified: true`)
- `localhost:3000` → use query param `?org=slug` or `DEV_TENANT_SLUG` env var

Tenant resolution logic lives in `frontend/lib/tenant.ts`. The disabled middleware (`middleware.ts.disabled`) was intended for edge-based tenant routing — do not re-enable without testing carefully.

**During local development**, set `DEV_TENANT_SLUG` in `.env.local` to your test org's slug, or append `?org=body-glow-pilates` to URLs.

---

## Authentication

- NextAuth v4 with `CredentialsProvider` (email + bcrypt password).
- Strategy is **JWT** (no database sessions).
- The JWT and session carry: `id`, `mustChangePassword`, and `organizations[]` (with role per org).
- Auth config is at `frontend/lib/auth.ts`.
- Auth API route: `app/api/auth/[...nextauth]/route.ts`.
- Protected pages should check `getServerSession(authOptions)` server-side.
- The `mustChangePassword` flag forces a redirect to `/change-password` on next login.
- Login page: `/login` (inside `(auth)` route group).

---

## Path Aliases

Defined in `tsconfig.json`:

```ts
@/*         → frontend/* (root of the Next.js app)
@/shared/*  → ../shared/* (shared monorepo folder)
```

Always use these aliases — never use relative `../../` imports across the `frontend/` and `shared/` boundary.

---

## TypeScript Rules

- `strict: true` is enabled — no implicit `any`.
- Never use `as any` except in NextAuth callback edge cases already present in `lib/auth.ts`.
- Do not modify auto-generated files (`next-env.d.ts`, `tsconfig.tsbuildinfo`).
- NextAuth type augmentations live in `types/next-auth.d.ts`.
- Shared types (canonical source of truth for business logic) live in `shared/types/`.

---

## API Routes

All API routes are under `frontend/app/api/` using the Next.js App Router Route Handlers.

Pattern: `app/api/<resource>/[id]/route.ts`

Key route groups:
- `/api/auth/*` — NextAuth + password change
- `/api/bookings/*` — create, list, update, availability
- `/api/sessions/*` — service sessions + timetable CRUD
- `/api/clients/*` — client management + membership renewal
- `/api/spaces/*` — space management
- `/api/admin/*` — admin-only: check-in by booking or client, membership
- `/api/availability/*` — availability queries
- `/api/contact` — email contact form (Nodemailer)
- `/api/organization/policy` — org booking policy

Always validate the session and resolve the org context at the top of each route handler. Never trust client-supplied `organizationId` alone — always cross-reference against the authenticated user's org memberships.

---

## UI & Styling

- Tailwind CSS with `tailwind-merge` and `clsx` for class composition.
- Custom UI primitives in `components/ui/`: `button.tsx`, `card.tsx`, `input.tsx`, `time-input.tsx`.
- Layout: `components/layout/MobileNav.tsx` — mobile-first navigation.
- Auth components in `components/auth/`.
- Session components in `components/sessions/`.
- Root layout at `app/layout.tsx`, providers (NextAuth SessionProvider) at `app/providers.tsx`.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pooled) |
| `NEXTAUTH_URL` | Full URL of the app (e.g. `https://spacyy.com`) |
| `NEXTAUTH_SECRET` | Secret for signing JWT tokens |
| `NEXT_PUBLIC_MAIN_DOMAIN` | Base domain for subdomain routing (`spacyy.com`) |
| `DEV_TENANT_SLUG` | Local dev fallback tenant slug |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (not yet active) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (not yet active) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (not yet active) |
| `SMTP_HOST` | Email SMTP host |
| `SMTP_PORT` | Email SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP app password |
| `SMTP_FROM` | From address for outgoing email |

---

## Commands

```bash
# Development
npm run dev             # Start dev server (from frontend/)
npm run lint            # ESLint
npm run type-check      # TypeScript check (no emit)
npm run check           # Lint + type-check
npm run check:full      # Lint + build

# Database (Prisma)
npm run db:generate     # Regenerate Prisma client after schema changes
npm run db:push         # Push schema changes to DB (no migration file)
npm run db:migrate      # Create and apply migration
npm run db:studio       # Open Prisma Studio (visual DB browser)

# Setup scripts (run once)
npm run setup:user      # Create first admin/owner user
npm run setup:client    # Create a client user
npm run hash:password   # Hash a password manually
```

All commands should be run from `frontend/` unless noted otherwise.

---

## What NOT to Do

- **Do not use the Supabase JS client** (`@supabase/supabase-js`) for data access — everything goes through Prisma.
- **Do not bypass multi-tenancy** — always scope queries to `organizationId`.
- **Do not trust user-supplied org IDs** without verifying against the authenticated session.
- **Do not use `useEffect` for data fetching** — prefer Server Components or API routes.
- **Do not re-enable `middleware.ts.disabled`** without thoroughly testing tenant routing edge cases.
- **Do not commit secrets** — `.env` and `.env.local` contain real credentials and should never be committed.
- **Do not add `as any`** outside of the existing NextAuth workarounds.
- **Do not modify `shared/types/enums.ts`** without also updating the Prisma schema enums, and vice versa.
- **Do not use relative imports** across the `frontend/` ↔ `shared/` boundary — always use `@/shared/*`.
