# PodBrief

The world's top tech & finance podcasts, turned into short written briefs and
served through a personalized feed. See the PRD for the full product spec.

**Stack:** Next.js 16 (App Router, TS) · Tailwind v4 · Supabase (Postgres + Auth
+ RLS) · Anthropic (summarization) · Groq/Deepgram (transcription) · Taddy
(podcast directory). Deploys on Vercel; the heavy pipeline runs as a separate
worker (M2+).

## Milestone status

All five milestones are implemented (v1 feature-complete; iterate from here).

- **M1 — Skeleton & data ✅** — Next.js + Tailwind, schema + RLS, auth, seed
- **M2 — Pipeline ✅** — transcribe → two-pass summarize → validate → brief,
  `process-episode` CLI, vitest suite
- **M3 — Automation ✅** — Postgres job queue + worker, Taddy webhook, RSS
  poller cron, cost logging, role-gated admin
- **M4 — Product UI ✅** — onboarding, feed, reader, catalog, saved, settings;
  public reader with ISR + OG images
- **M5 — Polish ✅** — loading/error/404 states, sitemap/robots/manifest,
  analytics, auth rate limiting

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

### 6. The pipeline & worker

Get brief quality right first by running the pipeline on individual episodes
(needs `ANTHROPIC_API_KEY` + `GROQ_API_KEY`; install `ffmpeg` for episodes over
~24 MB):

```bash
pnpm process-episode "https://lexfridman.com/feed/podcast/"        # latest episode
pnpm process-episode "<feed-url>" --index 1                        # an older one
pnpm process-episode --episode-id <uuid>                            # re-run a stored episode
```

Tune the two prompts in `src/lib/pipeline/prompts.ts` until briefs clear the
editorial bar. Then run the background worker, which drains the Postgres job
queue (ingest feeds → process episodes):

```bash
pnpm worker
```

In production the worker runs as a small always-on container (Railway/Fly, ~$5/mo
— **not** serverless). Vercel Cron hits `/api/cron/poll-feeds` every 30 min to
enqueue ingests; set `CRON_SECRET` so the endpoint is protected.

**Want $0/month?** Run the worker on GitHub Actions instead (`pnpm tick`, see
`.github/workflows/pipeline.yml`) and set `LLM_PROVIDER=groq` so summarization
uses Groq's free tier. Full step-by-step in **[docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md)**.

To make yourself an admin (for `/admin`), set your profile role in Supabase:
`update profiles set role = 'admin' where user_id = '<your-auth-uid>';`

## Scripts

| Script                  | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `pnpm dev`              | Dev server                                    |
| `pnpm build`            | Production build                              |
| `pnpm typecheck`        | `tsc --noEmit`                                |
| `pnpm lint`             | ESLint                                        |
| `pnpm test`             | Vitest (validation, quote, RSS, job queue)    |
| `pnpm worker`           | Run the background job worker                  |
| `pnpm process-episode`  | Run the full pipeline on one episode (CLI)     |
| `pnpm db:seed`          | Seed the show catalog into Supabase            |
| `pnpm db:verify-feeds`  | Check that catalog feeds resolve (no DB write) |

## Project layout

```
src/
  app/
    page.tsx              landing
    login/ onboarding/ feed/ saved/ settings/   app screens
    shows/ shows/[slug]/  catalog + show detail
    b/[showSlug]/[episodeSlug]/   public reader (ISR) + opengraph-image
    admin/                role-gated pipeline/cost/brief/show management
    api/cron/poll-feeds/  RSS poller (Vercel Cron)
    api/webhooks/taddy/   new-episode webhook
    auth/{callback,confirm,signout}/   auth route handlers
    {sitemap,robots,manifest}.ts, loading/error/not-found.tsx
  components/             header, brief card, reader, follow/save buttons
  lib/
    pipeline/             rss, transcription, extract, editorial, validate, pipeline
    jobs/                 queue + handlers (Postgres-backed)
    data/                 queries + user-action server actions
    supabase/{client,server,service,public,middleware}.ts
    auth/admin.ts  rate-limit.ts  utils/{slug,format}.ts
    types/database.ts     typed schema (regenerate once the project is live)
  proxy.ts                session refresh + route gating (Next 16 "proxy")
worker/index.ts           background job worker (long-running)
supabase/migrations/      SQL schema + RLS + claim_job() + daily_costs view
scripts/                  process-episode (CLI), seed/verify catalog
```

## Notes for Next 16

This project uses **Next.js 16**, which renames Middleware → **Proxy**
(`src/proxy.ts`) and makes `cookies()` async. The bundled docs live in
`node_modules/next/dist/docs` — check them before relying on older patterns.
