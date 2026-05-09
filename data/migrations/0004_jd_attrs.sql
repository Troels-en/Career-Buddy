-- 0004 — Structured JD attributes extracted from description text.
--
-- All optional. Frontend reads them for filter chips and richer fit-score.
-- Plain columns (not jsonb) so they're queryable + indexable.

alter table jobs
  add column if not exists years_min smallint,
  add column if not exists years_max smallint,
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_currency text,
  add column if not exists languages_required text[] default '{}'::text[];

create index if not exists idx_jobs_years_min on jobs(years_min) where years_min is not null;
create index if not exists idx_jobs_languages on jobs using gin (languages_required);
