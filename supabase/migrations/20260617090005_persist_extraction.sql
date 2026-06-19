-- PodBrief — persist the pass-1 extraction (data flywheel, council §moat #2).
--
-- The extraction holds timestamped claims, named entities (people/companies),
-- numbers, disagreements, and quotes per episode. We were discarding it after
-- the editorial pass. Persisting it from day 1 is the architecture decision
-- that unlocks future cross-episode intelligence ("what did every major show
-- say about topic X over the last 6 months?") without building that feature now.

alter table public.briefs
  add column if not exists extraction jsonb;
