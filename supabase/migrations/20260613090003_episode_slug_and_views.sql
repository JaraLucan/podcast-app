-- PodBrief — episode slugs + queue claim function + cost view (M2/M3)

-- ---------------------------------------------------------------------------
-- Episode slug for clean public reader URLs: /b/<show-slug>/<episode-slug>
-- ---------------------------------------------------------------------------
alter table public.episodes add column if not exists slug text;
create unique index if not exists episodes_show_slug_idx
  on public.episodes (show_id, slug);

-- ---------------------------------------------------------------------------
-- Atomic job claim for the worker (FOR UPDATE SKIP LOCKED) — PRD §3.
-- Claims one due pending job, marks it running, bumps attempts, returns it.
-- ---------------------------------------------------------------------------
create or replace function public.claim_job()
returns public.jobs
language plpgsql
as $$
declare
  claimed public.jobs;
begin
  select * into claimed
  from public.jobs
  where status = 'pending' and run_after <= now()
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
-- Daily spend rollup for the admin cost dashboard (PRD §5.5).
-- ---------------------------------------------------------------------------
create or replace view public.daily_costs as
with t as (
  select date_trunc('day', created_at)::date as day,
         sum(cost_usd) as transcript_cost,
         count(*) as transcripts
  from public.transcripts
  group by 1
),
b as (
  select date_trunc('day', created_at)::date as day,
         sum(cost_usd) as brief_cost,
         count(*) as briefs
  from public.briefs
  group by 1
)
select
  coalesce(t.day, b.day) as day,
  coalesce(t.transcript_cost, 0) as transcript_cost,
  coalesce(b.brief_cost, 0) as brief_cost,
  coalesce(t.transcript_cost, 0) + coalesce(b.brief_cost, 0) as total_cost,
  coalesce(t.transcripts, 0) as transcripts,
  coalesce(b.briefs, 0) as briefs
from t
full outer join b on t.day = b.day
order by day desc;
