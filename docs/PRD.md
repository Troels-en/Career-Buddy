# PRD — fa-track

## Problem

Business-background grads who want to enter the startup ecosystem face a fragmented landscape:
- **30+ Founders Associate / BizOps / Strategy roles** posted across VC career-pages, startup careers, LinkedIn-stealth, accelerator cohorts (EF, Antler, Picus FA-Program, Cherry, Earlybird).
- **No central tracker.** Every application = scattered traces in Gmail, LinkedIn-DMs, WhatsApp, ad-hoc Notion-pages, Excel-sheets.
- **No memory.** Existing tools (Clera, Huntr, Teal) treat each application as transactional. They forget your CV, prior conversations, what worked.
- **No self-knowledge.** Which role-types respond? Which industries fit? What's your conversion rate? Pure guesswork.
- **No skill-gap-closer.** Even if you know what role you want, you don't know what course/event/network gets you there fastest.

## Solution

fa-track is the **persistent career-companion** for first-startup-roles, starting with FA + adjacent BizOps/Strategy/BD/GTM positions.

Onion-Layered:
- **Layer 0 (this hackathon):** Application Tracker with AI auto-classification + curated job-feed
- **Layer 1 (4 weeks):** Gmail-connected, real VC-scrapers, LinkedIn-sync
- **Layer 2 (6 months):** CV-Coach, Cover-Letter, Interview-Prep, Growth-Recommender (courses, videos, events)
- **Layer 3 (Year 1+):** Career Buddy — persistent context-memory, switch-timing, salary-negotiation, headhunter-broker

The moat compounds. The Buddy that knows you 3 years > any headhunter.

## ICP (Layer 0)

**Primary:**
- 22–28 years old
- Bucerius / CDTM / CLSBE / INSEAD / HEC / LBS / WHU / ESCP / RSM / Frankfurt-School / Bocconi / IE
- 0–2 years post-graduation experience (consulting analyst, banking analyst, internal-startup-intern, BCG-junior)
- DACH or willing-to-relocate-DACH
- Target: Founders Associate, Investment Analyst (FA-style), Operating-Associate, BizOps, Strategy, BD, Chief-of-Staff entry-level

**Anti-Persona:** engineers (different track), senior 5+y (different value-prop), generic-job-seekers (too broad).

## Layer 0 Features (2h Hackathon Ship)

### F1 — Onboarding Chat
- 3-Q LLM dialogue: target role, background, geo
- Output: User-Profile-Card (Supabase row, displayed in UI)

### F2 — CV Upload
- PDF drop or paste-text
- Claude extracts: skills, prior roles, education, languages, certifications
- Profile enriched with `cv_summary`, `top_skills`, `gap_skills_for_target`

### F3 — Add Application
- Form: Company, Role, Application-URL, Date-Applied
- AI parses URL/JD content: extracts requirements, location, stage
- Computes `fit_score` (0–10) vs. user-profile
- Inserts row in `applications` table

### F4 — Mock Inbox Sync
- "Sync Gmail" button (mocked for hackathon)
- Loads 8 pre-defined emails from `data/mock_emails.json`
- Per email: AI classifies as `rejection | interview-invite | follow-up-question | offer | confirmation | silent-flag`
- Auto-finds matching `applications` row, updates `status`, adds `notes`, sets `next_action`

### F5 — Insights Panel
- AI scans `users.profile + applications + events` and surfaces 3 insight bullets:
  - Response-rate by role-type
  - Average pipeline-velocity per company
  - Pattern-recognition ("strong fit signals: B2B + Series-A + Berlin")

### F6 — VC Jobs Feed
- Loads 15 curated DACH FA-openings from `data/vc_jobs.json`
- AI ranks each vs. user-profile, shows top-3 highlighted
- Each entry: company, role, location, fit-score, "why this matches" 1-liner

### F7 — Demo Data
- On signup, 3 sample applications pre-loaded so demo can flow without real data:
  - Pedlar (Founders Associate) — status=rejected
  - Avi (Investment Analyst) — status=interview-2
  - Rust (Operating Associate) — status=applied

## Cut from Layer 0 (Layer 1+)

- Real Gmail OAuth (Google-Cloud-Console + Consent-Screen, 30–60 min by itself)
- Live VC-Career-Page scrapers
- LinkedIn-Connections-Graph
- Cover-Letter-Generator
- Interview-Prep-Workflow
- Growth-Recommender (courses/videos/events)
- Salary-Compass

## Tech Stack

- **Frontend:** Lovable-generated React + Tailwind
- **Backend:** Supabase (Auth + Postgres + Storage)
- **AI:** OpenAI gpt-4o or Anthropic claude-3.5-sonnet via Lovable's built-in connector
- **PDF parsing:** Lovable file-upload → text-extraction → LLM-structuring

## Data Schema

```sql
-- Users
create table users (
  id uuid primary key,
  email text,
  name text,
  target_role text,
  target_geo text,
  background text,
  cv_text text,
  profile_json jsonb,
  created_at timestamptz default now()
);

-- Applications
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  company text,
  role text,
  url text,
  applied_date date,
  status text default 'applied',  -- applied | rejected | interview-1 | interview-2 | offer | accepted | declined | silent
  fit_score numeric,
  notes text,
  last_event_date timestamptz,
  next_action text,
  created_at timestamptz default now()
);

-- Email events (mock for Layer 0)
create table events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id),
  event_type text,  -- rejection | interview-invite | follow-up-question | offer | confirmation
  email_subject text,
  email_body text,
  parsed_action text,
  parsed_at timestamptz default now()
);

-- VC Jobs Feed (pre-loaded, no scraper for Layer 0)
create table vc_jobs (
  id uuid primary key default gen_random_uuid(),
  company text,
  role text,
  location text,
  url text,
  description text,
  requirements text,
  posted_date date,
  fit_score numeric  -- computed per-user via AI
);
```

## Success Criteria (Hackathon)

- [ ] Live demo: Onboarding → CV-upload → Add-app → Sync-inbox → Insights → Jobs-feed in 3 minutes
- [ ] Public repo with PRD + sample data + Lovable-prompt
- [ ] Founder-Energy 10/10 — show live applications in real demo flow
- [ ] At least 1 user from hackathon onboards to use it for their own applications

## Long-Term Differentiation

vs. **Clera** (Junior-Job-Board): Clera's WhatsApp chat forgets context. fa-track is persistent + Career-Buddy-trajectory.
vs. **Huntr / Teal** (Generic Job-Trackers): Generic. fa-track is FA-vertical + AI-auto-classify + curated-feed.
vs. **Otta / Welcome-to-the-Jungle** (Curated Job-Feeds): Read-only. fa-track is read + write + memory.
vs. **Resume-Worded / Teal-CV** (CV-Coaches): CV-only. fa-track is CV + applications + interviews + network.
vs. **BetterUp / MentorPass** (Career-Coaches): Human-coach, expensive. fa-track is AI + cheaper + always-on.

## Pricing (post-hackathon)

- Layer 0: free (lead-magnet, public repo demo)
- Layer 1: €9/mo Indie
- Layer 2: €29/mo Pro (CV-Coach + Cover-Letter + Growth-Recommender)
- Layer 3: €79/mo Premium (full Career-Buddy) + B2B €30/seat (Career-Service-as-Benefit for top universities & corporates)
