-- Single-user dismissed jobs.
--
-- Mirrors data/migrations/0003_job_dismissals.sql for Supabase migration tools.

create table if not exists job_dismissals (
  url text primary key,
  dismissed_at timestamptz default now()
);

create index if not exists idx_job_dismissals_dismissed_at on job_dismissals(dismissed_at desc);
