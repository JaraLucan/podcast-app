# PodBrief

The world's top tech & finance podcasts, turned into short written briefs and
served through a personalized feed. See the PRD for the full product spec.

**Stack:** Next.js 16 (App Router, TS) · Tailwind v4 · Supabase (Postgres + Auth
+ RLS) · Anthropic (summarization) · Groq/Deepgram (transcription) · Taddy
(podcast directory). Deploys on Vercel; the heavy pipeline runs as a separate
worker (M2+).

## Milestone status

- **M1 — Skeleton & data ✅ (this commit)**
  - Next.js + Tailwind app scaffold
  - Full Postgres schema + RLS migrations (`supabase/migrations`)
  - Auth: email magic link + Google OAuth (Supabase SSR)
  - Seed script for the launch catalog (~30 shows)
- M2 — Offline-first pipeline (transcribe → two-pass summarize → brief) — _next_
- M3 — Automation (Taddy webhooks, RSS poller, retries, admin)
- M4 — Product UI (feed, reader, catalog, saved, settings)
- M5 — Polish & launch prep

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`. At minimum, M1 needs the three Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase →
  Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same page (server-only; never sent to the
  browser)

### 2. Database

Create a Supabase project, then apply the migrations either by pasting the SQL
into the Supabase SQL editor **in order**, or via the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/*.sql
```

Migrations:

1. `20260613090001_initial_schema.sql` — tables, indexes, triggers, the
   auto-profile-on-signup trigger, `is_admin()`
2. `20260613090002_rls_policies.sql` — Row Level Security (public-read catalog;
   per-user follows/reads/saves; service-role-only transcripts/jobs)

### 3. Auth providers

In Supabase → Authentication:

- **Email** (magic link) works out of the box.
- **Google**: enable the Google provider and add the redirect URL
  `http://localhost:3000/auth/callback` (and your production URL later).

The default Supabase email template redirects to `/auth/callback?code=…`. If you
switch the template to use `{{ .TokenHash }}`, the `/auth/confirm` route handles
it instead.

### 4. Seed the catalog

Resolves each curated show's real RSS feed + artwork via the iTunes Search API
and upserts into `shows` (safe to re-run; keyed on `slug`):

```bash
pnpm db:seed
```

Review the resolved titles it prints — a wrong iTunes match means a wrong feed.

### 5. Run

```bash
pnpm dev          # http://localhost:3000
```

## Scripts

| Script           | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Dev server                            |
| `pnpm build`     | Production build                      |
| `pnpm typecheck` | `tsc --noEmit`                        |
| `pnpm lint`      | ESLint                                |
| `pnpm db:seed`   | Seed the show catalog into Supabase   |

## Project layout

```
src/
  app/
    page.tsx              landing
    login/                magic-link + Google sign-in
    auth/{callback,confirm,signout}/   auth route handlers
    feed/                 placeholder feed (real UI is M4)
  lib/
    supabase/{client,server,service,middleware}.ts
    types/database.ts     typed schema (regenerate once the project is live)
  proxy.ts                session refresh + route gating (Next 16 "proxy")
supabase/migrations/      SQL schema + RLS
scripts/                  shows.seed.ts (data) + seed-shows.ts (seeder)
```

## Notes for Next 16

This project uses **Next.js 16**, which renames Middleware → **Proxy**
(`src/proxy.ts`) and makes `cookies()` async. The bundled docs live in
`node_modules/next/dist/docs` — check them before relying on older patterns.
