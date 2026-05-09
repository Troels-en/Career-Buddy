-- 0003 — Single-user dismissed jobs.
--
-- Stores hidden job URLs in Supabase so the role feed stays cleaned up across
-- browsers. No auth/user dimension: Career-Buddy is single-user for now.

create table if not exists job_dismissals (
  url text primary key,
  dismissed_at timestamptz default now()
);

create index if not exists idx_job_dismissals_dismissed_at on job_dismissals(dismissed_at desc);
