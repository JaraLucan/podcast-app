-- PodBrief — reclaim jobs orphaned in 'running' state.
--
-- A worker killed mid-job (GitHub Actions timeout, crash) leaves its claimed
-- job stuck in 'running' forever: claim_job only looks at 'pending'. Treat a
-- running job whose lock is older than 30 minutes as abandoned and re-claim it.

create or replace function public.claim_job()
returns public.jobs
language plpgsql
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
