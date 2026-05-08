# Career-Buddy — Project Context (Stable Knowledge)

> **For Lovable's project memory.** This file is durable. It describes who, why, and what-must-never-change. Build instructions live in `LOVABLE_PROMPT.md`. Iterative tweaks live in `REFINEMENT_PROMPTS.md`. Lovable: when generating new documentation, save it as `.md` under `/docs/` so it ships with the repo.

---

## 1. Problem Statement

Business-background graduates from Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU, ESCP, RSM, Frankfurt-School, Bocconi, IE chase Founders-Associate, BizOps, Strategy, BD, Chief-of-Staff, and junior-VC roles **without the structured recruiting funnels they know from consulting or banking**.

Their pain:
- **Fragmented pipeline.** Applications scatter across Gmail, LinkedIn-DMs, WhatsApp threads, accelerator portals (Picus FA, Cherry, Earlybird, EF, Antler), ad-hoc Notion pages, and Excel sheets.
- **No memory.** Generic trackers (Huntr, Teal, Simplify) treat each application as transactional — they forget the CV, prior conversations, what worked.
- **No self-knowledge.** Which role-types respond? Which industries fit? What's the conversion rate? Pure guesswork.
- **No skill-gap-closer.** Even when the target role is clear, the path to it (course, event, network) is not.

**Why now.** Graduation cliff + cohort competition + tight startup hiring window. Engineers have LeetCode and FAANG funnels; business-background grads have nothing equivalent for the operator track.

**Differentiation.**
- vs. Huntr / Teal / Simplify: generic trackers — Career-Buddy is FA-vertical + auto-classify + curated feed.
- vs. Clera (Junior-Job-Board WhatsApp): forgets context — Career-Buddy is persistent.
- vs. Otta / Welcome-to-the-Jungle: read-only feeds — Career-Buddy reads + writes + remembers.
- vs. BetterUp / MentorPass: human coach, expensive — Career-Buddy is AI, cheaper, always-on.

---

## 2. ICP (Layer 0)

- 22–28 years old.
- Top business or interdisciplinary master programs (see schools above).
- 0–2 years post-graduation experience (consulting analyst, banking analyst, intern at startup, BCG-junior).
- DACH or willing-to-relocate-DACH.
- Target roles: Founders Associate, Investment Analyst (FA-style), Operating Associate, BizOps, Strategy, BD, Chief-of-Staff entry-level.

**Anti-Persona.** Engineers (different track), senior 5+y (different value-prop), generic job-seekers (too broad).

---

## 3. Vision (Onion-Layered Roadmap)

- **Layer 0 (this hackathon, mock-mode):** Application Tracker + curated job-feed + cached "AI" classification.
- **Layer 1 (4 weeks):** Real Gmail OAuth, live VC-career-page scrapers, LinkedIn sync.
- **Layer 2 (6 months):** CV-Coach, Cover-Letter, Interview-Prep, Growth-Recommender (courses, events, Maven cohorts).
- **Layer 3 (Year 1+):** Career-Buddy — persistent multi-year memory, switch-timing, salary-negotiation, headhunter-broker.

**Moat.** A buddy that knows you 3 years > any headhunter.

---

## 4. Brand & Voice

- **Name.** Career-Buddy — coach-tone, not corporate. Friendly companion, not HR software.
- **Tone split.**
  - Hero copy + Vision strip → **coach-tone** (warm, direct, second-person).
  - Tracker rows + status badges + summary strips → **clinical-tone** (terse, factual, no fluff).
- **No emoji decoration in UI.** Use proper SVG icons or plain text.
- **Aesthetic.** Linear / Notion. Restrained. One accent color (purple `#7c3aed`). No gradient backgrounds, no colored left borders on cards, no text-in-circle logos.

---

## 5. Why Mock Mode (Hackathon Demo Constraint)

Demo determinism > live AI. Same pitch, every time, no API failure risk.

- No live LLM calls. No API keys. Zero connector setup.
- Every "AI" string is hardcoded or read literally from JSON fixtures.
- No real PDF parsing, no real email sync, no real URL fetching.
- All persistence is `localStorage` (key: `"career-buddy-state"`).
- Supabase tables exist in the repo schema but are **out of scope for Layer 0**.

This lets a 60–90 second walkthrough run identically on any laptop, any network, with the same wow-moment.

---

## 6. Demo Audience & Success Criteria

- **Audience.** Hackathon judges in tech / VC. Expect a 60–90 second walkthrough, no Q&A on infrastructure.
- **Wow moment.** "Sync Inbox" button → 8 cached emails fan out across the tracker → 6 applications change status with a purple flash → summary strip lands.
- **Success criteria.**
  1. Live demo: Onboarding → CV-paste → Add-app → Sync-inbox → Insights → Jobs-feed inside 3 minutes.
  2. Demo runs deterministically on any device with the repo cloned.
  3. Founder-energy 10/10 — looks shippable, not slideware.
  4. At least 1 hackathon attendee onboards to track their own applications.

---

## 7. Hard Constraints (Never Violate)

- **No live API calls.** No OpenAI / Anthropic / Claude / GPT / LLM connectors. No API keys.
- **No Supabase Auth, no Supabase Storage, no Google login, no email APIs, no real PDF parsing, no URL fetching.**
- **All "AI" output is deterministic.** Every visible string is hardcoded in the build prompt or read literally from `/data/mock_emails.json` and `/data/vc_jobs.json`. No inference, no generation.
- **Persistence:** `localStorage` only (key `"career-buddy-state"`).
- **No references to OpenAI, Anthropic, GPT, Claude, or any LLM provider** in generated app UI, comments, variable names, or user-facing strings — except the visible status pill `"Mock AI mode · cached demo responses"`.

---

## 8. Non-Goals (Cut from Layer 0)

- Real Gmail OAuth (30–60 min Google-Cloud-Console alone).
- Live VC career-page scrapers.
- LinkedIn connections graph.
- Cover-letter generator.
- Interview-prep workflow.
- Growth-recommender (courses, videos, events).
- Salary compass.
- Payments, teams, settings, notifications panels.

---

## 9. Tech Stack (Lovable Build)

- **Frontend.** React + Tailwind (Lovable-generated).
- **Persistence.** `localStorage` (single source of truth for Layer 0).
- **Data fixtures.** `/data/mock_emails.json`, `/data/vc_jobs.json`. Lovable reads these literally; if a file is missing it falls back to the canonical inline tables in `LOVABLE_PROMPT.md`.
- **Out of scope for Layer 0.** Supabase tables (`users`, `applications`, `events`, `vc_jobs`) exist in the repo schema but are not used at runtime.

---

## 10. Visual System (Durable Design Tokens)

- **Background:** `#FFFFFF`
- **Text:** `#111827` (charcoal)
- **Accent:** `#7c3aed` (purple) — primary buttons, focus rings, top-3 glow, animation flash
- **Font:** Inter, fallback `system-ui, sans-serif`
- **Radii:** 12px cards, 8px inputs, 9999px pills
- **Shadow:** `shadow-sm` cards, `shadow-md` on hover
- **Spacing:** `py-8` between sections, `gap-4` inside cards
- **Layout grid:** `max-w-6xl mx-auto px-6`
- **Mobile breakpoint:** `<768px` → stack single-column, sticky sidebar becomes inline.

---

## 11. Documentation Convention

Lovable: when adding documentation, decisions, or rationale, save them as `.md` files under `/docs/` so they ship as repo documentation. Examples: `/docs/PRD.md`, `/docs/DEMO.md`, `/docs/PROJECT_CONTEXT.md`, `/docs/LOVABLE_PROMPT.md`, `/docs/REFINEMENT_PROMPTS.md`. Do not embed long-form docs inside React components.
