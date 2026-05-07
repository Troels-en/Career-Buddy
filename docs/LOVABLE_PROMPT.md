# Lovable Master-Prompt — Career-Buddy v3 (Mock-Mode, Phased)

Paste the block below as initial Lovable prompt. Phased priority is built in: if time runs short, Lovable will still produce a demo-ready Phase-1 even if Phase-2/3 stay rough.

---

```
Build a single-page web app called "Career-Buddy" — a Founders-Associate / startup-entry-role application tracker for business-background graduates (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS) who want to land their first startup role outside engineering.

THIS IS A 2-HOUR HACKATHON DEMO BUILD RUNNING IN MOCK MODE.

================================================================
HARD CONSTRAINTS (NEVER VIOLATE)
================================================================
- NO live API calls. NO OpenAI / Anthropic / Claude / GPT / LLM connectors. NO API keys.
- NO Supabase Auth. NO Supabase Storage. NO Google login. NO email APIs. NO real PDF parsing. NO URL fetching.
- All "AI" output is deterministic. Every visible string is hardcoded below or read literally from /data/mock_emails.json and /data/vc_jobs.json (no inference, no generation).
- Persist app state to localStorage (key "career-buddy-state"). Optionally write to existing Supabase tables IF a Supabase client is already configured; otherwise skip Supabase entirely. The app must work end-to-end with localStorage alone.
- NO references to OpenAI, Anthropic, GPT, Claude, or any LLM provider in the UI or in code (except the visible status pill "Mock AI mode · cached demo responses").

================================================================
PHASED BUILD PRIORITY (INTERPRET THIS LITERALLY)
================================================================
PHASE 1 — ABSOLUTELY MUST SHIP (target: first 60 min)
  - Section 0: Header
  - Section 1: Onboarding & Profile (chat input + canned reply + profile card; CV textarea + canned analysis)
  - Section 2: Applications Tracker — pre-seeded 8 rows, Add-Application modal, **Sync Inbox with stagger animation + summary strip**
  - Section 5: Career-Buddy Vision Strip (one-line at bottom)

PHASE 2 — SHOULD SHIP (target: 60-90 min)
  - Section 3: Insights Panel (3 hardcoded bullets + refresh shimmer)

PHASE 3 — NICE-TO-HAVE (target: 90-105 min, only if Phase 1+2 fully working)
  - Section 4: VC Jobs Feed (15 cards, top-3 glow, Add-to-tracker)

If at any point the build is not converging cleanly, drop Section 4 first, then Section 3. Never drop Section 2's Sync Inbox — that is the demo's single most important feature.

================================================================
STACK
================================================================
React + Tailwind. Existing Supabase Postgres tables (`users`, `applications`, `events`, `vc_jobs`) may be used read-only or skipped. localStorage is the source of truth.

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
- Far right: small "Reset demo" link (text-xs text-gray-400, underline). On click: clear localStorage and reload — used between demo runs.

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
- Below the assistant reply, render the PROFILE CARD.

PROFILE CARD (always visible after first submit; collapses to a one-line summary after Sync runs, with "edit profile" link to expand):
  Name:        Troels K.
  Target Role: Founders Associate / Operating Associate
  Target Geo:  DACH (Berlin / Remote)
  Background:  CLSBE Master, business track
  Strong:      B2B-sales, structured thinking
  Gap:         SaaS-metrics, ML fundamentals

CV PASTE-ZONE (NOT a PDF dropzone):
- Below the profile card, a <textarea> (rows=4) labeled "Paste your CV text". Below it, button "Analyze CV".
- On click (or on textarea input >50 chars): 800ms simulated delay, then APPEND to the profile card a "CV analysis" block with this exact text:
  "Strong: B2B-sales, structured thinking.
   Gap: SaaS-metrics, ML fundamentals.
   Recommend: SaaStr-basics module before next interview."
- NEVER attempt real PDF/text parsing. Always return the canned string.

================================================================
SECTION 2 — APPLICATIONS TRACKER (left column, 2/3 width)
================================================================
Card-styled table. Columns: Company | Role | Status | Last Event | Next Action | Fit

PRE-SEED 8 ROWS on first load (mix of VC-FA-roles and startup-operator-roles to match the "outside engineering" positioning):
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
- Modal with fields: company, role, url (optional), applied_date (default today)
- Submit: 700ms simulated delay, then append a new row with status=applied, fit=8.4, next_action="Prep B2B-deal example"
- Do NOT fetch or parse the URL.

SYNC INBOX (THE DEMO WOW MOMENT):
The mock_emails.json file contains exactly these 8 entries (CANONICAL CONTRACT — if the file is missing or differs, use this list verbatim):

| # | matches_company  | expected_classification | subject (one-line)                                |
|---|------------------|-------------------------|---------------------------------------------------|
| 1 | Pedlar           | rejection               | Re: Founders Associate application — outcome      |
| 2 | Avi              | interview-invite        | Avi Investment Analyst — next steps               |
| 3 | Rust             | (no email — silent)     | (no event)                                        |
| 4 | Picus Capital    | interview-invite        | Coffee chat — Picus Capital FA Program            |
| 5 | Cherry Ventures  | rejection               | Cherry Ventures Investment Analyst — decision     |
| 6 | Project A        | follow-up-question      | Quick question on your CV (Kim @ Project A)       |
| 7 | Earlybird        | confirmation            | Earlybird Investment Analyst — application received |
| 8 | Speedinvest      | offer                   | Offer — Speedinvest Investment Associate          |

Each entry exposes: matches_company, expected_classification, subject, body, date, from. Read these fields literally — DO NOT classify or infer.

ROW-CHANGE LEDGER (drives the summary count):
- 6 rows change status: Pedlar (rejected), Avi (interview-2), Picus Capital (interview-2), Cherry Ventures (rejected), Project A (follow-up-needed), Speedinvest (offer)
- 1 row updates only its last_event_date but NOT its status: Earlybird (confirmation — counts as scanned, NOT counted in "6 applications updated")
- 1 row receives no event at all: Rust (no matching email — counts as scanned only)
- "6 next actions created" = the same 6 rows that changed status

CLASSIFICATION → UPDATE MAPPING (deterministic, no inference):
  rejection           → status="rejected",        next_action="Ask for feedback (draft ready)"
  interview-invite    → status="interview-2";
                        for matches_company="Avi": next_action="Thu 3pm CET market sizing case"
                        for matches_company="Picus Capital": next_action="Coffee chat — pick 3 slots"
  follow-up-question  → status="follow-up-needed", next_action="Reply to Kim: B2B deal example"
  offer               → status="offer",            next_action="Review offer letter — €52k base"
  confirmation        → status unchanged (still "applied"), only update last_event_date to email.date

ANIMATION SPEC (declarative — keep this primitive simple):
- On Sync click, the button enters loading state for 1500ms. Show inside the button: small spinner + text "Scanning 8 cached emails…"
- During that 1500ms window, walk through emails in this exact order and apply updates with a 250ms stagger between each row:
    1. Pedlar           → rejected
    2. Avi              → interview-2
    3. Picus Capital    → interview-2
    4. Cherry Ventures  → rejected
    5. Project A        → follow-up-needed
    6. Earlybird        → confirmation (no badge change, only last_event_date)
    7. Rust             → no email match, no change
    8. Speedinvest      → offer
- Each row receives a single 400ms `bg-purple-100` flash via Tailwind transition-colors duration-[400ms] ease-out, then settles to its new badge state and updated next_action text.
- Do NOT add typewriter effects, scale tweens, or per-row custom animations. ONE animation primitive across all rows. Keep it simple.

ANIMATION FALLBACK (if Lovable's first generation produces broken stagger):
- Acceptable degradation: spinner runs for 1500ms, then ALL changed rows update simultaneously with a single 400ms purple-100 flash. The summary strip still renders. This is a fully acceptable v1.
- Refinement prompts can attempt the stagger upgrade later.

SUMMARY STRIP (renders at t≈1800ms after Sync, below the table):
Full-width, bg-gray-50, rounded-lg, px-4 py-3, text-sm, with this exact text:
  "8 emails scanned · 6 applications updated · 6 next actions created · 1 offer received"

(Math: 6 status changes = Pedlar, Avi, Picus, Cherry, Project A, Speedinvest. Earlybird's status didn't change but Rust got no event. Next-actions updated for the same 6 rows.)

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

LOAD vc_jobs.json (15 entries, fields: company, role, location, url, description, requirements, posted_date) and apply HARDCODED FIT SCORES:
- Cherry Ventures: 8.7 | Earlybird Venture Capital: 8.4 | Project A Ventures: 8.1
- Picus Capital: 7.9 | Speedinvest: 7.7 | HV Capital: 7.5
- Lakestar: 7.3 | Atomico: 7.1 | General Catalyst: 6.9
- Plural: 6.7 | 9Yards Capital: 6.5 | 468 Capital: 6.3
- Sastrify: 6.1 | Trade Republic: 5.9 | Helsing: 5.7

WHY-THIS-MATCHES (hardcoded by company):
- Cherry Ventures: "Matches your B2B + Series-A focus — direct overlap with target."
- Earlybird Venture Capital: "Berlin HQ, B2B portfolio, FA-track structured similarly to your goal."
- Project A Ventures: "Operator-led, strong CLSBE alumni network, B2B SaaS lean."
- All others: "DACH-based VC with FA-track openings — review JD."

TOP-3 GLOW: cards for Cherry Ventures, Earlybird Venture Capital, Project A Ventures get `ring-2 ring-purple-500 ring-opacity-50` plus `animate-pulse` (slow, 2s).

"Add to tracker" → append to Section 2 with status=applied, fit=card's fit, next_action="Awaiting reply".

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
- Every interaction <2s perceived latency. Use simulated 400-800ms delays only where the "AI" needs to feel real.
- Optimistic UI: update state first; spinner only inside Sync button (1500ms while animation plays).
- localStorage key: "career-buddy-state". Persist applications array + profile. Restore on page load. If state already exists on first load, skip the "Build profile" flow and show populated app immediately.
- Mobile responsive (<768px): sections stack single-column, sticky sidebar becomes inline.
- Favicon: a purple "C" on white circle.

================================================================
ACCEPTANCE CRITERIA (CHECKLIST)
================================================================
Phase 1 (must work):
1. App loads with 8 pre-seeded applications visible immediately.
2. Onboarding chat input accepts text and renders the canned reply + profile card.
3. CV textarea accepts paste/text and appends the canned analysis block.
4. "+ Add Application" modal works and appends a row.
5. "Sync Inbox" button runs the animation (stagger preferred, simultaneous-flash acceptable as fallback) and ends with the summary strip showing exactly: "8 emails scanned · 6 applications updated · 6 next actions created · 1 offer received".
6. After Sync: Pedlar=rejected, Avi=interview-2, Picus Capital=interview-2, Cherry Ventures=rejected, Project A=follow-up-needed, Speedinvest=offer; Earlybird and Rust unchanged status.
7. "Reset demo" link in header clears state and reloads.

Phase 2 (should work):
8. Insights panel shows all 3 hardcoded bullets, refresh button shimmers and re-renders.

Phase 3 (nice-to-have):
9. VC Jobs Feed shows 15 cards from vc_jobs.json with hardcoded fit scores; top 3 (Cherry, Earlybird, Project A) glow.
10. "Add to tracker" on a job card appends a row to Section 2.

Always:
11. Career-Buddy Vision Strip visible at the bottom.
12. NO references in UI or code to OpenAI, Anthropic, GPT, Claude, or any external AI provider.
13. Mobile-responsive layout under 768px.

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

---

## Iterative Refinement Prompts (only if specific issue surfaces)

1. **Sync stagger broken** — "Re-implement Sync Inbox stagger using a setTimeout chain at 250ms intervals in this exact company order: Pedlar, Avi, Picus Capital, Cherry Ventures, Project A, Earlybird, Rust, Speedinvest. Each row applies bg-purple-100 for 400ms then settles to its final badge state. No typewriter, no scale animations."

2. **Top-3 glow too weak** — "Increase top-3 jobs glow to ring-2 ring-purple-500 ring-opacity-60 + animate-pulse (2s, slow)."

3. **Mock pill missing** — "Add the 'Mock AI mode · cached demo responses' status pill to the top-right of the sticky header."

4. **Status pre-seed mismatch** — "Pre-seed exactly the 8 rows specified in Section 2 of the master prompt. Reset state in localStorage if needed."
