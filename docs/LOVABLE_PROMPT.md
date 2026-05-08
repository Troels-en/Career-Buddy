# Lovable Master-Prompt — Career-Buddy v4 (Mock-Mode, Phased)

> **Read first:** `/docs/PROJECT_CONTEXT.md` (problem, persona, vision, brand, hard constraints, design tokens). This file = build instructions only. Iterative tweaks live in `/docs/REFINEMENT_PROMPTS.md`. Save new documentation as `.md` under `/docs/`.

Paste the block below as initial Lovable prompt. Phased priority is built in: if time runs short, Lovable still ships a demo-ready Phase-1 even if Phase-2/3 stay rough.

---

```
Build a single-page web app called "Career-Buddy" — a Founders-Associate / startup-entry-role application tracker for business-background graduates (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU, ESCP, RSM, Bocconi, IE) chasing their first non-engineering startup role: Founders Associate, BizOps, Strategy, BD, Chief-of-Staff, junior VC.

THIS IS A 2-HOUR HACKATHON DEMO BUILD RUNNING IN MOCK MODE. Stable project context (problem, persona, vision, brand, design tokens, hard constraints) is in /docs/PROJECT_CONTEXT.md — treat it as authoritative background.

================================================================
HARD CONSTRAINTS (NEVER VIOLATE)
================================================================
- NO live API calls. NO OpenAI / Anthropic / Claude / GPT / LLM connectors. NO API keys.
- NO Supabase Auth. NO Supabase Storage. NO Google login. NO email APIs. NO real PDF parsing. NO URL fetching.
- All "AI" output is deterministic. Every visible string is hardcoded below or read literally from /data/mock_emails.json and /data/vc_jobs.json (no inference, no generation).
- Persist app state to localStorage (key "career-buddy-state"). DO NOT write to Supabase. Supabase tables exist in the repo schema but are out of scope for this build.
- NO references to OpenAI, Anthropic, GPT, Claude, or any LLM provider in generated app UI, code comments, variable names, or user-facing strings — except the visible status pill "Mock AI mode · cached demo responses".

================================================================
PHASED BUILD PRIORITY (INTERPRET LITERALLY)
================================================================
PHASE 1 — ABSOLUTELY MUST SHIP (target: first 60 min)
  - Section 0: Header
  - Section 1: Onboarding & Profile (chat input + canned reply + profile card; CV textarea + canned analysis)
  - Section 2: Applications Tracker — pre-seeded 8 rows, Add-Application modal, Sync Inbox with stagger animation + summary strip
  - Section 5: Career-Buddy Vision Strip (compact footer)

PHASE 2 — SHOULD SHIP (target: 60–90 min)
  - Section 3: Insights Panel (3 hardcoded bullets + refresh shimmer)

PHASE 3 — NICE-TO-HAVE (target: 90–105 min, only if Phase 1+2 fully working)
  - Section 4: VC Jobs Feed (15 cards, top-3 glow, Add-to-tracker)

If the build is not converging cleanly, drop Section 4 first, then Section 3. NEVER drop Section 2's Sync Inbox — that is the demo's single most important feature.

================================================================
STACK
================================================================
React + Tailwind. localStorage is the source of truth. No backend at runtime.

================================================================
VISUAL SYSTEM (DO NOT INVENT VARIATIONS)
================================================================
- Background: #FFFFFF
- Text: #111827 (charcoal)
- Accent: #7c3aed (purple) — primary buttons, focus rings, top-3 glow, animation flash
- Font: Inter, fallback system-ui, sans-serif
- Border radius: 12px on cards, 8px on inputs, 9999px on pills
- Shadow: shadow-sm on cards, shadow-md on hover
- Spacing: py-8 between sections, gap-4 inside cards
- Layout grid: max-w-6xl mx-auto px-6
- Aesthetic: Linear / Notion. NO emoji decoration. NO gradient backgrounds. NO colored left borders on cards.
- Mobile (<768px): stack everything single-column, sticky sidebar becomes inline.

================================================================
PAGE STRUCTURE
================================================================
1. Section 0 — Sticky header
2. Section 1 — Onboarding & Profile
3. Workbench: Section 2 (Applications, 2/3 width left) + Section 3 (Insights, 1/3 sticky right)
4. Section 4 — VC Jobs Feed (full-width)
5. Section 5 — Career-Buddy Vision Strip (compact footer)

================================================================
SECTION 0 — HEADER
================================================================
Sticky top bar:
- Left: text logo "Career-Buddy" (font-semibold, text-lg, accent color #7c3aed)
- Right: status pill "Mock AI mode · cached demo responses" (text-xs, bg-gray-100, rounded-full, px-3 py-1)
- Far right: small "Reset demo" link (text-xs, text-gray-400, underline). On click: clear localStorage, reload, AND restart the full onboarding flow (do not skip the Build-profile chat on the reloaded page).

================================================================
SECTION 1 — ONBOARDING & PROFILE
================================================================
Hero tagline (text-3xl font-semibold tracking-tight, mb-2): "Land your first startup role."
Subhead (text-base text-gray-500, mb-6): "Track applications, learn what works, find roles that fit. For business-background grads chasing Founders-Associate, BizOps, Strategy, BD."

ONBOARDING CHAT:
- Card with chat-style text input. Placeholder: "Tell me what kind of role you want and your background."
- Submit button: "Build profile"
- On submit (any non-empty text): show 600ms "Building your profile…" spinner inside the button, then render this exact assistant reply in a chat bubble below the input:
  "Got it. Target: Founders Associate at AI-startups + Operating Associate / BizOps / Strategy roles at early-stage startups. Geo: Berlin / Remote-DACH. Background: CLSBE Master, business track, 0–2y experience."
- Below the assistant reply, render the PROFILE CARD (expanded form).

PROFILE CARD STATES:
- EXPANDED (default after first submit, and on every page reload):
    Name:        Troels K.
    Target Role: Founders Associate / Operating Associate
    Target Geo:  DACH (Berlin / Remote)
    Background: CLSBE Master, business track
    Strong:      B2B-sales, structured thinking
    Gap:         SaaS-metrics, ML fundamentals
- COLLAPSED (after Sync Inbox runs once): single-line summary
    "Troels K. · Founders Associate · Berlin / Remote-DACH · CLSBE Master"
  with an "edit profile" link (text-xs, accent-colored, underline) that re-expands the card to its full form.

CV PASTE-ZONE (NOT a PDF dropzone):
- Below the profile card, a <textarea rows=4> labeled "Paste your CV text". Below it, button "Analyze CV".
- Trigger: button click ONLY (no auto-trigger on text length). On click: 800ms simulated delay, then APPEND a "CV analysis" block to the profile card with this exact text:
  "Strong: B2B-sales, structured thinking.
   Gap: SaaS-metrics, ML fundamentals.
   Recommend: SaaStr-basics module before next interview."
- NEVER attempt real PDF/text parsing. Always return the canned string.

RELOAD BEHAVIOR:
- On reload, if localStorage state exists, render the populated app (Sections 2–5 visible, profile card collapsed if Sync was already run, expanded otherwise).
- Onboarding chat input remains visible at the top so judges can see the full arc on first run.
- Reset demo link in the header is the only way to wipe state and restart from scratch.

================================================================
SECTION 2 — APPLICATIONS TRACKER (left column, 2/3 width)
================================================================
Card-styled table. Columns: Company | Role | Status | Last Event | Next Action | Fit

PRE-SEED 8 ROWS on first load (mix of VC-FA roles and startup-operator roles to match the "outside engineering" positioning):

| # | Company          | Role                   | Status   | Last Event | Next Action          | Fit |
|---|------------------|------------------------|----------|------------|----------------------|-----|
| 1 | Pedlar           | Founders Associate     | applied  | —          | Awaiting reply       | 7.2 |
| 2 | Avi              | Investment Analyst     | applied  | 2 days ago | Awaiting reply       | 8.4 |
| 3 | Rust             | Operating Associate    | applied  | 6 days ago | Awaiting reply       | 6.8 |
| 4 | Picus Capital    | FA Program             | applied  | —          | Awaiting reply       | 8.1 |
| 5 | Cherry Ventures  | Investment Analyst     | applied  | —          | Awaiting reply       | 7.4 |
| 6 | Project A        | Strategy Associate     | applied  | —          | Awaiting reply       | 7.9 |
| 7 | Earlybird        | Investment Analyst     | applied  | —          | Awaiting reply       | 6.5 |
| 8 | Speedinvest      | Investment Associate   | applied  | —          | Awaiting reply       | 8.7 |

STATUS BADGE STYLES (Tailwind, pill-shaped, text-xs, font-medium, px-2 py-1, rounded-full):
- applied             → bg-gray-100 text-gray-700
- interview-1         → bg-blue-100 text-blue-800
- interview-2         → bg-blue-200 text-blue-900
- rejected            → bg-red-100 text-red-700
- offer               → bg-green-100 text-green-700
- follow-up-needed    → bg-yellow-100 text-yellow-800
- confirmation        → bg-gray-50 text-gray-600

FIT SCORE COLOR (text only, font-semibold):
- ≥ 8.0  → text-green-600
- 5.0–7.9 → text-yellow-600
- < 5.0  → text-red-600

CONTROLS (above the table, right-aligned):
- "+ Add Application" (secondary button — bg-white border)
- "Sync Inbox" (PRIMARY DEMO BUTTON — large, bg-purple-600 text-white, font-semibold, px-6 py-2.5, rounded-lg, shadow-md hover:shadow-lg, with mail-icon to its left)

ADD APPLICATION:
- Modal with fields: company, role, url (optional), applied_date (default = today, ISO format).
- Submit: 700ms simulated delay, then append a new row with status=applied, fit=8.4, next_action="Prep B2B-deal example".
- Do NOT fetch or parse the URL.

SYNC INBOX (THE DEMO WOW MOMENT):

Mock_emails.json contains exactly 8 entries (CANONICAL CONTRACT — if the file is missing or differs, use this list verbatim):

| # | matches_company  | expected_classification | subject (one-line)                                  |
|---|------------------|-------------------------|-----------------------------------------------------|
| 1 | Pedlar           | rejection               | Re: Founders Associate application — outcome        |
| 2 | Avi              | interview-invite        | Avi Investment Analyst — next steps                 |
| 3 | Rust             | confirmation            | Application received — Operating Associate          |
| 4 | Picus Capital    | interview-invite        | Coffee chat — Picus Capital FA Program              |
| 5 | Cherry Ventures  | rejection               | Cherry Ventures Investment Analyst — decision       |
| 6 | Project A        | follow-up-question      | Quick question on your CV (Kim @ Project A)         |
| 7 | Earlybird        | confirmation            | Earlybird Investment Analyst — application received |
| 8 | Speedinvest      | offer                   | Offer — Speedinvest Investment Associate            |

Each entry exposes: matches_company, expected_classification, subject, body, date (ISO), from. Read these fields literally — DO NOT classify or infer.

ROW-CHANGE LEDGER (drives the summary count):
- 6 rows change status (status_changed=true): Pedlar (rejected), Avi (interview-2), Picus Capital (interview-2), Cherry Ventures (rejected), Project A (follow-up-needed), Speedinvest (offer).
- 2 rows update only their last_event_date (status unchanged): Earlybird (confirmation), Rust (confirmation).
- "8 emails scanned" = all 8 mock entries were processed.
- "6 applications updated" = the 6 rows whose status changed.
- "6 next actions created" = the same 6 rows.
- "1 offer received" = Speedinvest.

CLASSIFICATION → UPDATE MAPPING (deterministic, no inference):
  rejection           → status="rejected",         next_action="Ask for feedback (draft ready)"
  interview-invite    → status="interview-2";   // intentional jump applied → interview-2 to signal a positive accelerated round
                          for matches_company="Avi": next_action="Thu 3pm CET market sizing case"
                          for matches_company="Picus Capital": next_action="Coffee chat — pick 3 slots"
  follow-up-question  → status="follow-up-needed", next_action="Reply to Kim: B2B deal example"
  offer               → status="offer",            next_action="Review offer letter — €52k base"
  confirmation        → status unchanged (still "applied"); update last_event_date to email.date; next_action unchanged.

ANIMATION SPEC (declarative — keep this primitive simple):
- On Sync click, the button enters loading state for 2000ms. Show inside the button: small spinner + text "Scanning 8 cached emails…"
- During the 2000ms window, walk through emails in this exact order, applying updates with a 250ms stagger between each row (first update at t=0, last at t=1750ms):
    1. Pedlar           → rejected
    2. Avi              → interview-2
    3. Picus Capital    → interview-2
    4. Cherry Ventures  → rejected
    5. Project A        → follow-up-needed
    6. Earlybird        → confirmation (no badge change, only last_event_date)
    7. Rust             → confirmation (no badge change, only last_event_date)
    8. Speedinvest      → offer
- Each row receives a single 400ms `bg-purple-100` flash via Tailwind transition-colors duration-[400ms] ease-out, then settles to its new badge state and updated next_action text.
- Do NOT add typewriter effects, scale tweens, or per-row custom animations. ONE animation primitive across all rows. Keep it simple.

ANIMATION FALLBACK (if Lovable's first generation produces broken stagger):
- Acceptable degradation: spinner runs for 2000ms, then ALL changed rows update simultaneously with a single 400ms purple-100 flash. The summary strip still renders. This is a fully acceptable v1.
- Refinement prompts can attempt the stagger upgrade later.

SUMMARY STRIP (renders at t=2200ms after Sync click, below the table):
Full-width, bg-gray-50, rounded-lg, px-4 py-3, text-sm, with this exact text:
  "8 emails scanned · 6 applications updated · 6 next actions created · 1 offer received"

POST-SYNC PROFILE COLLAPSE:
- Once Sync has run successfully, collapse the profile card to its one-line summary form (see Section 1).

================================================================
SECTION 3 — INSIGHTS PANEL (right sticky sidebar, 1/3 width — Phase 2)
================================================================
Title (text-base font-semibold, mb-3): "Patterns"

Render exactly these three bullets, hardcoded (each in its own card: bg-gray-50, rounded-lg, p-4, mb-2):
  • B2B-focused VC roles respond 3× more than B2C — focus your pipeline.
  • Picus Capital pipeline avg 21 days — be patient, not silent.
  • Strong-fit signals: Series-A + Berlin + B2B SaaS exposure.

Refresh button (text-xs, accent-colored, link-style, below the bullets): "Refresh patterns"
- On click: 300ms shimmer (animate-pulse) on each bullet, then re-render the same exact three bullets.

================================================================
SECTION 4 — VC JOBS FEED (full-width — Phase 3)
================================================================
Section title (text-2xl font-semibold, mb-4): "FA roles you might fit"
Subtitle (text-sm text-gray-500, mb-6): "15 curated DACH openings, ranked by fit to your profile."

Card grid: 3 cols desktop, 2 tablet, 1 mobile. gap-4.
Each card (bg-white, border, rounded-12px, p-5, shadow-sm, hover:shadow-md):
- Top-right corner: fit-score badge (colored per Section 2 thresholds, font-bold)
- Company name (font-semibold, text-base)
- Role (text-sm)
- Location (text-xs text-gray-500)
- "Why this matches" line (text-sm, mt-3, italic)
- "Add to tracker" button at bottom (text-xs, accent border, rounded-lg)

LOAD vc_jobs.json (15 entries; fields: company, role, location, url, description, requirements, posted_date) and apply HARDCODED FIT SCORES:
- Cherry Ventures: 8.7 | Earlybird Venture Capital: 8.4 | Project A Ventures: 8.1
- Picus Capital: 7.9 | Speedinvest: 7.7 | HV Capital: 7.5
- Lakestar: 7.3 | Atomico: 7.1 | General Catalyst: 6.9
- Plural: 6.7 | 9Yards Capital: 6.5 | 468 Capital: 6.3
- Sastrify: 6.1 | Trade Republic: 5.9 | Helsing: 5.7

WHY-THIS-MATCHES (deterministic by fit_score rank, NOT by hardcoded company name):
- Top-3 by fit (descending sort): "Matches your B2B + Series-A focus — direct overlap with target."
- All others: "DACH-based VC with FA-track openings — review JD."

TOP-3 GLOW: compute the top-3 cards by fit_score (descending) at render time. Apply to those 3 cards: `ring-2 ring-purple-500 ring-opacity-50` plus `animate-pulse` (slow, 2s). Do NOT hardcode company names — derive from data so re-scoring stays consistent.

"Add to tracker" → append to Section 2 with status=applied, fit=card's fit, next_action="Prep B2B-deal example" (matches Add-Application default).

================================================================
SECTION 5 — CAREER-BUDDY VISION STRIP (compact footer)
================================================================
Full-width strip, bg-gray-50, py-6, text-center.
Heading (text-sm uppercase tracking-wider text-gray-500): "Roadmap — for startup operators, not just VC-track"
Body (text-base text-gray-700, mt-2):
  "Today: tracker + insights + role-feed. Next: skill recommender (courses, events, Maven cohorts). Year-1: persistent Career-Buddy with multi-year memory — switch-timing, salary-negotiation, headhunter broker."

================================================================
GLOBAL RULES
================================================================
- Every interaction <2s perceived latency. Use simulated 400-800ms delays for the onboarding chat (600ms) and CV analysis (800ms); 700ms for Add Application; 2000ms for Sync Inbox. These are intentional pacing, not real network calls.
- Optimistic UI: update state first; spinners only inside the buttons that triggered the action (Build profile, Analyze CV, Add Application, Sync Inbox).
- localStorage key: "career-buddy-state". Persist applications array + profile + sync-completed flag. Restore on page load.
- Mobile responsive (<768px): sections stack single-column, sticky sidebar becomes inline.
- Favicon: a purple "C" on white circle.
- Documentation: when generating supporting docs (rationale, change-log, decisions), save them as .md files under /docs/ — not inside React components.

================================================================
ACCEPTANCE CRITERIA (CHECKLIST)
================================================================
Phase 1 (must work):
1. App loads with 8 pre-seeded applications visible immediately.
2. Onboarding chat input accepts text and renders the canned reply + expanded profile card.
3. CV textarea accepts paste/text and "Analyze CV" button click appends the canned analysis block.
4. "+ Add Application" modal works and appends a row.
5. "Sync Inbox" button runs the animation (stagger preferred, simultaneous-flash acceptable as fallback) and ends with the summary strip showing exactly: "8 emails scanned · 6 applications updated · 6 next actions created · 1 offer received".
6. After Sync: Pedlar=rejected, Avi=interview-2, Picus Capital=interview-2, Cherry Ventures=rejected, Project A=follow-up-needed, Speedinvest=offer; Earlybird and Rust unchanged status (only last_event_date updated).
7. Profile card collapses to its one-line form after Sync; "edit profile" re-expands it.
8. "Reset demo" link in header clears state, reloads, and restarts onboarding from scratch.

Phase 2 (should work):
9. Insights panel shows all 3 hardcoded bullets, refresh button shimmers and re-renders.

Phase 3 (nice-to-have):
10. VC Jobs Feed shows 15 cards from vc_jobs.json with hardcoded fit scores; top-3 by fit (Cherry, Earlybird, Project A) glow — derived from data, not hardcoded names.
11. "Add to tracker" on a job card appends a row to Section 2.

Always:
12. Career-Buddy Vision Strip visible at the bottom.
13. NO references in UI or code to OpenAI, Anthropic, GPT, Claude, or any external AI provider.
14. Mobile-responsive layout under 768px.

================================================================
DEMO NARRATIVE (60–90 SECOND ARC THE UI MUST SUPPORT)
================================================================
1. Page loads → tagline + 8 pre-seeded applications visible immediately.
2. Demoer types into onboarding chat → profile card builds.
3. Demoer pastes CV text → "Analyze CV" → analysis block appends.
4. Demoer clicks "+ Add Application" → new row appears.
5. Demoer clicks "Sync Inbox" → 8 cached emails fan out across the tracker, 6 rows flash purple and change status, summary strip lands. THIS IS THE WOW MOMENT.
6. Demoer scrolls to Insights → 3 pattern bullets.
7. Demoer scrolls to Jobs Feed → 15 cards, top-3 glow.
8. Vision strip closes the pitch.

================================================================
DO NOT IMPLEMENT
================================================================
- Real OpenAI / Anthropic / GPT / Claude / LLM integration
- Any API key connector
- Real email sync (Gmail, IMAP, etc.)
- Real PDF parsing
- Real URL fetching or HTML scraping
- Supabase Auth flow
- Supabase Storage uploads
- Payment, teams, settings, notifications panels
```
