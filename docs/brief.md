# brief.md — Career-Buddy

> **Lovable convention:** this is the durable product brief. Every feature added must trace back to this file. If a request conflicts, flag it before building.

## Problem statement

Business-background graduates from Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU, ESCP, RSM, Bocconi, IE need a way to run a structured first-startup-role search because their applications scatter across Gmail, LinkedIn-DMs, WhatsApp threads, accelerator portals, and ad-hoc Notion / Excel sheets — and existing trackers (Huntr, Teal, Simplify, Clera) have no memory, no role-vertical fit, and no skill-gap-closer.

## Primary user

- 22–28 year old business-background master's graduate (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU, ESCP, RSM, Bocconi, IE).
- 0–2 years post-graduation experience (consulting analyst, banking analyst, BCG-junior, intern at startup).
- DACH-based or willing to relocate to DACH.
- Target roles: Founders Associate, Investment Analyst (FA-style), Operating Associate, BizOps, Strategy, BD, Chief-of-Staff entry-level.
- **Anti-persona.** Engineers (different track), senior 5+y (different value-prop), generic job-seekers (too broad).

## Core job

Run one cockpit for the entire first-startup-role search: profile in, applications tracked, "AI" sync that classifies inbox events into status updates and next actions, curated DACH job feed ranked by fit.

## What makes this better than alternatives

- **vs. Huntr / Teal / Simplify** — generic trackers; Career-Buddy is FA-vertical with auto-classify + curated feed.
- **vs. Clera (WhatsApp Junior-Job-Board)** — forgets context; Career-Buddy is persistent.
- **vs. Otta / Welcome-to-the-Jungle** — read-only feeds; Career-Buddy reads + writes + remembers.
- **vs. BetterUp / MentorPass** — human coach, expensive; Career-Buddy is AI, cheaper, always-on.

## Vision (onion-layered roadmap)

- **Layer 0 (this hackathon, mock mode).** Application Tracker + curated job feed + cached "AI" classification. Demonstrates the core loop deterministically.
- **Layer 1 (4 weeks).** Real Gmail OAuth, live VC-career-page scrapers, LinkedIn sync.
- **Layer 2 (6 months).** CV-Coach, Cover-Letter, Interview-Prep, Growth-Recommender (courses, events, Maven cohorts).
- **Layer 3 (Year 1+).** Career-Buddy with persistent multi-year memory: switch-timing, salary-negotiation, headhunter-broker.

**Moat.** A buddy that knows you 3 years > any headhunter.

## Why mock mode for v1

- Demo determinism > live AI. Same pitch, every time, no API failure risk.
- No live LLM calls, no API keys, no connector setup.
- All "AI" output hardcoded or read literally from JSON fixtures (`/data/mock_emails.json`, `/data/vc_jobs.json`).
- `localStorage` is the only persistence (key `"career-buddy-state"`). Supabase tables in repo schema are out of scope for Layer 0.

## Success criteria (Layer 0 hackathon)

- Live demo runs Onboarding → CV-paste → Add-app → Sync-inbox → Insights → Jobs-feed in 60–90 seconds.
- Demo runs deterministically on any laptop with the repo cloned.
- Founder-energy 10/10 — looks shippable, not slideware.
- At least 1 hackathon attendee onboards to use it for their own applications.

## Demo audience

Hackathon judges in tech / VC. 60–90 second walkthrough. No Q&A on infrastructure. Wow moment = "Sync Inbox" → 8 cached emails fan out across the tracker → 6 applications change status with a purple flash → summary strip lands.

## Out of scope for v1

- Real Gmail OAuth / IMAP sync.
- Live VC career-page scrapers.
- LinkedIn connections graph.
- Cover-letter generator.
- Interview-prep workflow.
- Growth-recommender.
- Salary compass.
- Payments, teams, settings, notifications panels.
- Real PDF parsing.
- Real URL fetching or HTML scraping.
- Supabase Auth / Storage flows.
