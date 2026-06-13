-- PodBrief — Row Level Security (M1)
-- Rule of thumb (PRD §4):
--   * shows / episodes / briefs  -> public read (briefs only once published)
--   * follows / reads / saves / profiles -> each user sees only their own rows
--   * transcripts / jobs / pipeline writes -> service role only (RLS on, no
--     anon/authenticated policies). The service role key bypasses RLS, so the
--     worker and admin pages reach these through the server.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.shows       enable row level security;
alter table public.episodes    enable row level security;
alter table public.transcripts enable row level security;
alter table public.briefs      enable row level security;
alter table public.profiles    enable row level security;
alter table public.follows     enable row level security;
alter table public.reads       enable row level security;
alter table public.saves       enable row level security;
alter table public.jobs        enable row level security;

-- ---------------------------------------------------------------------------
-- Public-read catalog
-- ---------------------------------------------------------------------------
create policy "shows are public" on public.shows
  for select using (true);

create policy "episodes are public" on public.episodes
  for select using (true);

-- Published briefs are public; held/unpublished briefs are reachable only via
-- the service role (admin review).
create policy "published briefs are public" on public.briefs
  for select using (published_at is not null);

-- ---------------------------------------------------------------------------
-- profiles — owner only
-- ---------------------------------------------------------------------------
create policy "own profile readable" on public.profiles
  for select using (user_id = auth.uid());

create policy "own profile insertable" on public.profiles
  for insert with check (user_id = auth.uid());

create policy "own profile updatable" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- follows — owner only
-- ---------------------------------------------------------------------------
create policy "own follows readable" on public.follows
  for select using (user_id = auth.uid());

create policy "own follows insertable" on public.follows
  for insert with check (user_id = auth.uid());

create policy "own follows deletable" on public.follows
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reads — owner only
-- ---------------------------------------------------------------------------
create policy "own reads readable" on public.reads
  for select using (user_id = auth.uid());

create policy "own reads insertable" on public.reads
  for insert with check (user_id = auth.uid());

create policy "own reads updatable" on public.reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own reads deletable" on public.reads
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saves — owner only
-- ---------------------------------------------------------------------------
create policy "own saves readable" on public.saves
  for select using (user_id = auth.uid());

create policy "own saves insertable" on public.saves
  for insert with check (user_id = auth.uid());

create policy "own saves updatable" on public.saves
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own saves deletable" on public.saves
  for delete using (user_id = auth.uid());

-- transcripts and jobs intentionally have RLS enabled with NO policies:
-- only the service role (server-side worker / admin) can touch them.
