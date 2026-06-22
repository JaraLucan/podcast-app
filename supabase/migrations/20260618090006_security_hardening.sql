-- PodBrief — security & performance hardening (from code-review pass).
-- Addresses: profiles.role self-escalation, DMCA hold leaking via shows/episodes
-- direct REST, per-row auth.uid() re-eval, stuck 'running' jobs, missing FK
-- indexes, and over-broad grants on daily_costs / claim_job.

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers so the public-read policies can check dmca_hold
-- without being defeated by RLS on shows/episodes themselves.
-- ---------------------------------------------------------------------------
create or replace function public.show_held(p_show_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select dmca_hold from public.shows where id = p_show_id), false);
$$;

create or replace function public.episode_show_held(p_episode_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((
    select s.dmca_hold
    from public.episodes e
    join public.shows s on s.id = e.show_id
    where e.id = p_episode_id
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Public-read policies now exclude DMCA-held content (shows, episodes, briefs).
-- ---------------------------------------------------------------------------
drop policy if exists "shows are public" on public.shows;
create policy "shows are public" on public.shows
  for select using (not dmca_hold);

drop policy if exists "episodes are public" on public.episodes;
create policy "episodes are public" on public.episodes
  for select using (not public.show_held(show_id));

drop policy if exists "published briefs are public" on public.briefs;
create policy "published briefs are public" on public.briefs
  for select using (
    published_at is not null and not public.episode_show_held(episode_id)
  );

-- ---------------------------------------------------------------------------
-- profiles: lock the `role` column. Users may update their own profile but may
-- NOT change their role (prevents self-promotion to admin via direct PostgREST).
-- ---------------------------------------------------------------------------
drop policy if exists "own profile readable" on public.profiles;
drop policy if exists "own profile insertable" on public.profiles;
drop policy if exists "own profile updatable" on public.profiles;

create policy "own profile readable" on public.profiles
  for select using (user_id = (select auth.uid()));
create policy "own profile insertable" on public.profiles
  for insert with check (user_id = (select auth.uid()));
create policy "own profile updatable" on public.profiles
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- per-user policies: wrap auth.uid() in a scalar subquery so the planner
-- evaluates it once per query, not once per row (Supabase RLS best practice).
-- ---------------------------------------------------------------------------
drop policy if exists "own follows readable" on public.follows;
drop policy if exists "own follows insertable" on public.follows;
drop policy if exists "own follows deletable" on public.follows;
create policy "own follows readable" on public.follows
  for select using (user_id = (select auth.uid()));
create policy "own follows insertable" on public.follows
  for insert with check (user_id = (select auth.uid()));
create policy "own follows deletable" on public.follows
  for delete using (user_id = (select auth.uid()));

drop policy if exists "own reads readable" on public.reads;
drop policy if exists "own reads insertable" on public.reads;
drop policy if exists "own reads updatable" on public.reads;
drop policy if exists "own reads deletable" on public.reads;
create policy "own reads readable" on public.reads
  for select using (user_id = (select auth.uid()));
create policy "own reads insertable" on public.reads
  for insert with check (user_id = (select auth.uid()));
create policy "own reads updatable" on public.reads
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own reads deletable" on public.reads
  for delete using (user_id = (select auth.uid()));

drop policy if exists "own saves readable" on public.saves;
drop policy if exists "own saves insertable" on public.saves;
drop policy if exists "own saves updatable" on public.saves;
drop policy if exists "own saves deletable" on public.saves;
create policy "own saves readable" on public.saves
  for select using (user_id = (select auth.uid()));
create policy "own saves insertable" on public.saves
  for insert with check (user_id = (select auth.uid()));
create policy "own saves updatable" on public.saves
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own saves deletable" on public.saves
  for delete using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- claim_job: also reclaim jobs stuck in 'running' (worker killed mid-job, e.g.
-- a cancelled GitHub Actions runner) + pin search_path.
-- ---------------------------------------------------------------------------
create or replace function public.claim_job()
returns public.jobs
language plpgsql
security invoker set search_path = public, pg_temp
as $$
declare
  claimed public.jobs;
begin
  select * into claimed
  from public.jobs
  where (status = 'pending' and run_after <= now())
     or (status = 'running' and locked_at < now() - interval '30 minutes')
  order by run_after asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.jobs
  set status = 'running', locked_at = now(), attempts = attempts + 1
  where id = claimed.id
  returning * into claimed;

  return claimed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indexes: FK columns used by cascade deletes + catalog filters.
-- ---------------------------------------------------------------------------
create index if not exists follows_show_id_idx on public.follows (show_id);
create index if not exists reads_brief_id_idx on public.reads (brief_id);
create index if not exists saves_brief_id_idx on public.saves (brief_id);
create index if not exists takedown_requests_show_id_idx
  on public.takedown_requests (show_id);
create index if not exists shows_active_idx
  on public.shows (category) where is_active and not dmca_hold;
create index if not exists jobs_running_idx
  on public.jobs (locked_at) where status = 'running';

-- ---------------------------------------------------------------------------
-- Lock down grants: these are reached only via the service-role client.
-- ---------------------------------------------------------------------------
revoke select on public.daily_costs from anon, authenticated;
revoke execute on function public.claim_job() from public;
grant execute on function public.claim_job() to service_role;
