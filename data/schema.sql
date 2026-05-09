-- Career-Buddy schema (Layer-0 baseline).
--
-- This file is the legacy single-shot schema used during the hackathon.
-- The canonical migration history now lives in data/migrations/. To bring
-- a fresh database up to current state, run:
--
--   cd backend && uv run python -m career_buddy_scraper.cli.migrate
--
-- Do NOT add new tables here; create a new migration file instead.

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- users
-- ============================================================
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  name text,
  target_role text,
  target_geo text,
  background text,
  cv_text text,
  profile_json jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- applications
-- ============================================================
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  company text not null,
  role text,
  url text,
  applied_date date default current_date,
  status text default 'applied',
    -- allowed values:
    -- applied | rejected | interview-1 | interview-2 | offer
    -- accepted | declined | silent | follow-up-needed
  fit_score numeric,
  notes text,
  last_event_date timestamptz default now(),
  next_action text,
  created_at timestamptz default now()
);

create index if not exists idx_applications_user on applications(user_id);
create index if not exists idx_applications_company on applications(lower(company));

-- ============================================================
-- events  (email-related events linked to an application)
-- ============================================================
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade,
  event_type text not null,
    -- allowed values:
    -- rejection | interview-invite | follow-up-question | offer
    -- confirmation | silent-flag
  email_subject text,
  email_body text,
  parsed_action text,
  parsed_at timestamptz default now()
);

create index if not exists idx_events_application on events(application_id);

-- ============================================================
-- vc_jobs  (centralized, scraped daily, no per-user data)
-- ============================================================
create table if not exists vc_jobs (
  id uuid primary key default uuid_generate_v4(),
  company text not null,
  role text not null,
  location text,
  url text,
  description text,
  requirements text,
  posted_date date,
  scraped_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (light-touch for hackathon)
-- ============================================================
-- Disable RLS for hackathon to keep iteration fast.
-- Enable + add proper policies before going live with real users.

-- alter table users      enable row level security;
-- alter table applications enable row level security;
-- alter table events     enable row level security;

-- Read-only public access to vc_jobs is fine since it's curated public data.
-- alter table vc_jobs enable row level security;
-- create policy "vc_jobs are publicly readable" on vc_jobs for select using (true);
