-- PodBrief — PRD v2 §3 legal/copyright framework

-- ---------------------------------------------------------------------------
-- shows: DMCA hold + Partner "Featured" flag; allow ingest_source='blocked'
-- ---------------------------------------------------------------------------
alter table public.shows
  add column if not exists dmca_hold boolean not null default false;
alter table public.shows
  add column if not exists featured boolean not null default false;

-- Spotify-exclusive, paywalled, or "no summarization" shows (PRD v2 §3).
alter table public.shows drop constraint if exists shows_ingest_source_check;
alter table public.shows
  add constraint shows_ingest_source_check
  check (ingest_source in ('taddy', 'rss', 'blocked'));

-- ---------------------------------------------------------------------------
-- Takedown / DMCA request log (PRD v2 §3: "Log of all takedown requests")
-- ---------------------------------------------------------------------------
create table if not exists public.takedown_requests (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid references public.shows (id) on delete set null,
  email       text,
  reason      text,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
-- Service-role only (admin). RLS on, no anon/authenticated policies.
alter table public.takedown_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Hide briefs of DMCA-held shows everywhere (defense in depth, not just app
-- query): replace the public-read policy with one that excludes held shows.
-- ---------------------------------------------------------------------------
drop policy if exists "published briefs are public" on public.briefs;
create policy "published briefs are public" on public.briefs
  for select using (
    published_at is not null
    and not exists (
      select 1
      from public.episodes e
      join public.shows s on s.id = e.show_id
      where e.id = public.briefs.episode_id and s.dmca_hold = true
    )
  );
