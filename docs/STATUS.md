# PodBrief — stav projektu

Popis toho, co je hotové, co chybí, co musíš dodat ty, a co jsem přidal navíc
nad rámec PRD. Stav k červnu 2026 (commity `cc9ecc0` → dál).

Ověřeno: `pnpm typecheck`, `pnpm lint`, `pnpm test` (18 testů) a produkční
`pnpm build` procházejí. **Pipeline ale zatím neběžel proti reálným API** —
chybí klíče (viz níže).

---

## ✅ Co je hotové (PRD M1–M5)

### M1 — Kostra & data
- Next.js 16 (App Router, TS) + Tailwind v4.
- Kompletní Postgres schéma + RLS migrace v `supabase/migrations/`.
- Auth: e-mailový magic link + Google OAuth (Supabase SSR), session refresh přes
  `src/proxy.ts`.
- Seed katalogu ~30 shows; seeder dohledá reálné RSS feedy + obrázky přes iTunes
  Search API (`pnpm db:seed`, `pnpm db:verify-feeds`).

### M2 — Pipeline (kvalita briefů)
- Dvouprůchod: **Haiku** (extrakce faktů) → **Sonnet** (editorial brief), modely
  z env. Striktní JSON + zod validace + 1 retry s feedbackem.
- Kódová validace briefu (`validate.ts`): počet slov, max 1 krátký citát,
  timestampy v rozsahu epizody, neprázdné sekce → `quality_flags`. Co neprojde,
  se **nepublikuje automaticky**, ale jde do adminu k ruční revizi.
- Transkripce: reuse Taddy přepisu; jinak Groq Whisper (s ffmpeg chunkováním pro
  dlouhé epizody) **nebo** Deepgram (viz extras).
- CLI `pnpm process-episode <feed-url>` — celý pipeline na jedné epizodě.
- Vitest: validace, kontrola citátů, parsování/skip pravidla RSS.

### M3 — Automatizace
- Postgresová fronta `jobs` + atomické `claim_job()` (`FOR UPDATE SKIP LOCKED`),
  exponenciální backoff, 3 pokusy.
- Worker proces `pnpm worker` (ingest feedů → zpracování epizod).
- Taddy webhook (`/api/webhooks/taddy`) + RSS poller cron (`/api/cron/poll-feeds`,
  `vercel.json`, každých 30 min, chráněno `CRON_SECRET`).
- Cost logging (`transcripts.cost_usd`, `briefs.cost_usd`) + `daily_costs` view.
- Denní strop epizod jako pojistka proti utrženým nákladům
  (`MAX_EPISODES_PER_DAY`).
- Role-gated `/admin`: dashboard (stav pipeline + náklady), revize/publikace
  držených briefů, retry/smazání jobů, správa shows + **takedown** (1 klik
  odpublikuje všechny briefy show).

### M4 — Produktové UI
- Onboarding (výběr shows), feed (taby All/Unread/Saved, mark-read, mark-all,
  „Load more" stránkování), prémiová čtečka s klikatelnými timestampy (deep-link
  na YouTube `?t=`), katalog s **vyhledáváním** + filtrem kategorií, detail show,
  saved s poznámkami, settings vč. GDPR smazání účtu.
- Veřejná čtečka `/b/[show]/[episode]` je **ISR/SSG** (`generateStaticParams` +
  `revalidate`), s OG obrázkem a metadaty.

### M5 — Polish
- Stavy loading / error / 404, `sitemap.xml`, `robots.txt`, PWA `manifest`.
- Analytics (Plausible, zapne se přes env).
- Rate limiting na magic-link login (in-memory).

---

## 🔧 Co musíš udělat ty (jinak to nepojede naživo)

1. **`.env.local`** — zkopíruj z `.env.example` a vyplň. Minimum: Supabase
   (3 hodnoty) + `ANTHROPIC_API_KEY` + `GROQ_API_KEY` (nebo Deepgram). Pro
   automatizaci `CRON_SECRET`, `TADDY_*`.
2. **Migrace** — aplikuj všechny soubory v `supabase/migrations/` (SQL editor
   nebo `supabase db push`).
3. **Seed** — `pnpm db:seed`, pak ze sebe udělej admina:
   `update profiles set role='admin' where user_id='<tvoje uid>';`
4. **Ladění kvality** — `pnpm process-episode` na 5–10 reálných epizodách a
   uprav prompty v `src/lib/pipeline/prompts.ts`. Tohle je hlavní práce, kde se
   rodí kvalita produktu.
5. **Worker** — `pnpm worker` lokálně; v produkci malý always-on kontejner
   (Railway/Fly, ~$5/měs, **ne** serverless).
6. **Auth providers** v Supabase (Email + Google, redirect
   `…/auth/callback`).
7. **Pro dlouhé epizody** (>~24 MB) na Groq: nainstaluj `ffmpeg`/`ffprobe`,
   nebo přepni `TRANSCRIPTION_PROVIDER=deepgram` (Deepgram bere audio přes URL,
   bez stahování i ffmpeg).

---

## ⚠️ Co NENÍ hotové / vědomé limity

- **Pipeline neběžel end-to-end** proti reálným Groq/Anthropic/Taddy — ověř u
  sebe. Kvalita briefů je odhad, dokud ji neporovnáš na reálných epizodách.
- **Strict JSON** řeším promptem + zod validací + retry (ne přes API
  „structured outputs"). Robustní a model-agnostické, ale ne 100% garance jako
  schema-constrained výstup.
- **Job-queue**: logika fronty (enqueue, backoff, vyčerpání pokusů → failed) je
  unit-testovaná přes fake klienta; samotné atomické zamykání je v SQL funkci
  `claim_job()` se `SKIP LOCKED` a ověřuje se až za běhu workeru (ne v unit testu,
  vyžadovalo by živou DB).
- **Taddy webhook** parsuje payload best-effort (hledá UUID série a spustí
  ingest). Až budeš mít reálný Taddy formát, ověř/doostři mapování.
- **Sentry** je připravený (`src/lib/observability.ts`), ale balíček
  `@sentry/node` není nainstalovaný — zapne se po `pnpm add @sentry/node` +
  `SENTRY_DSN`. Bez toho jen `console.error`.
- **E-mailové digesty** jsou mimo v1 (schéma read/unread je připravené).
- **Reader save tlačítko** na ISR stránce dohydratuje stav klientsky přes
  `/api/brief-state` (krátké bliknutí „Save" před načtením).
- Žádné automatické nasazení (CI/CD, hosting workeru) — to je na tobě.

---

## ➕ Přidáno nad rámec PRD

- **Deepgram přes URL-ingest** — alternativa ke Groqu, která řeší dlouhé epizody
  bez stahování a ffmpeg (`TRANSCRIPTION_PROVIDER=deepgram`).
- **Veřejné RSS** `/rss.xml` s nejnovějšími briefy (distribuce + SEO).
- **`/api/health`** — liveness/readiness probe pro monitoring/uptime.
- **Default OG obrázek** webu + **JSON-LD `Article`** na čtečce (lepší sdílení
  a SEO nad rámec per-brief OG).
- **Privacy + Terms stránky** s takedown kontaktem a editorial/copyright
  postojem (PRD to zmiňuje, ale nebylo ve v1 milnících rozepsané).
- **Hydrated save button** + `/api/brief-state` — správný stav uložení i na
  statické (ISR) čtečce.
- **Observability util** (`reportError`, Sentry-ready, bez tvrdé závislosti).
- **`daily_costs` SQL view** + `claim_job()` jako čisté DB primitivy.
- **Landing s ukázkovými briefy + náhledem katalogu** (PRD §6.1) místo holého
  hero.

---

## 🧭 Jak to celé teče (zkráceně)

```
Cron / Taddy webhook
   └─ enqueue ingest_show  ─────────────┐
                                        ▼
                          worker: claim_job() (SKIP LOCKED)
                                        │
        ingest_show: poll RSS, skip rules, upsert epizod ──► enqueue process_episode
                                        │
   process_episode: transcribe (Taddy|Groq|Deepgram)
                    → extrakce (Haiku) → editorial (Sonnet)
                    → validace → publish | hold
                                        ▼
                          Postgres (briefs, transcripts, cost)
                                        ▼
   Next.js: feed (per-user, RLS) · čtečka /b/... (ISR, public) · admin (service role)
```

Detailní layout souborů je v `README.md`.
