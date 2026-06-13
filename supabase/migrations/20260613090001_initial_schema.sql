-- PodBrief — initial schema (M1)
-- Mirrors the data model in the PRD §4. Run via the Supabase SQL editor or
-- `supabase db push` (filenames are CLI-compatible timestamp_name.sql).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- shows
-- ---------------------------------------------------------------------------
create table public.shows (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  publisher     text,
  rss_url       text,
  taddy_uuid    text,
  image_url     text,
  category      text check (category in ('tech','finance','ai','crypto','business')),
  description   text,
  website_url   text,
  is_active     boolean not null default true,
  ingest_source text not null default 'taddy' check (ingest_source in ('taddy','rss')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index shows_category_idx on public.shows (category) where is_active;

create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- episodes
-- ---------------------------------------------------------------------------
create table public.episodes (
  id               uuid primary key default gen_random_uuid(),
  show_id          uuid not null references public.shows (id) on delete cascade,
  guid             text not null,
  title            text not null,
  description      text,
  audio_url        text,
  published_at     timestamptz,
  duration_seconds integer,
  youtube_url      text,
  status           text not null default 'discovered'
                     check (status in ('discovered','transcribing','summarizing','published','failed','skipped')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (show_id, guid)
);

create index episodes_show_id_idx      on public.episodes (show_id);
create index episodes_status_idx       on public.episodes (status);
create index episodes_published_at_idx on public.episodes (published_at desc);

create trigger episodes_set_updated_at
  before update on public.episodes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transcripts (1:1 with episode)
-- ---------------------------------------------------------------------------
create table public.transcripts (
  episode_id  uuid primary key references public.episodes (id) on delete cascade,
  source      text not null check (source in ('taddy','groq','deepgram')),
  segments    jsonb,            -- [{ start, end, speaker?, text }]
  full_text   text,
  word_count  integer,
  cost_usd    numeric(10,4) default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- briefs (1:1 with episode)
-- ---------------------------------------------------------------------------
create table public.briefs (
  id             uuid primary key default gen_random_uuid(),
  episode_id     uuid not null unique references public.episodes (id) on delete cascade,
  tldr           text,
  takeaways      jsonb,         -- string[]
  key_moments    jsonb,         -- [{ ts_seconds, label }]
  numbers        jsonb,         -- [{ label, value, context? }]
  why_it_matters text,
  model_used     text,
  tokens_in      integer,
  tokens_out     integer,
  cost_usd       numeric(10,4) default 0,
  quality_flags  jsonb,         -- output of the validation step
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index briefs_published_at_idx on public.briefs (published_at desc);

create trigger briefs_set_updated_at
  before update on public.briefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarded    boolean not null default false,
  role         text not null default 'user' check (role in ('user','admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience: is the current user an admin? (security definer to read profiles)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- follows / reads / saves (per-user)
-- ---------------------------------------------------------------------------
create table public.follows (
  user_id    uuid not null references auth.users (id) on delete cascade,
  show_id    uuid not null references public.shows (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);
create index follows_user_id_idx on public.follows (user_id);

create table public.reads (
  user_id  uuid not null references auth.users (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete cascade,
  read_at  timestamptz not null default now(),
  primary key (user_id, brief_id)
);
create index reads_user_id_idx on public.reads (user_id);

create table public.saves (
  user_id    uuid not null references auth.users (id) on delete cascade,
  brief_id   uuid not null references public.briefs (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, brief_id)
);
create index saves_user_id_idx on public.saves (user_id);

-- ---------------------------------------------------------------------------
-- jobs (Postgres-backed queue — PRD §3, no Redis)
-- ---------------------------------------------------------------------------
create table public.jobs (
  id         bigserial primary key,
  type       text not null,
  payload    jsonb,
  status     text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts   integer not null default 0,
  run_after  timestamptz not null default now(),
  locked_at  timestamptz,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Worker claim query hits this: pending jobs whose run_after has passed.
create index jobs_claim_idx on public.jobs (status, run_after) where status = 'pending';

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
