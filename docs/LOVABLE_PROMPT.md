# Lovable Master-Prompt

Paste this as initial Lovable prompt. Iterate from there.

---

```
Build a web app called "fa-track" — a Founders-Associate application tracker for business-background grads (Bucerius, CDTM, CLSBE, INSEAD types) who want to land their first startup role.

Stack: React + Tailwind, Supabase (Auth + Postgres + Storage), OpenAI GPT-4o for AI features.

Tone & visual: clean, modern, founder-aesthetic. White background, charcoal text, single accent color (#7c3aed purple). Inter or system-ui font. Card-based layout, generous spacing, no emoji-overload, professional like Linear or Notion.

LAYOUT:
Single-page app with three vertical sections stacked:

1. TOP — Onboarding & Profile (collapses after first use)
   - Chat input: "Tell me what kind of role you want and your background"
   - On submit: GPT extracts target_role, target_geo, background → saves to users table
   - Below input: profile card showing target_role, top_skills, gap_skills
   - File-drop zone: "Drop your CV PDF here" → extract text via PDF parsing → GPT extracts skills/strengths/gaps → enriches profile card

2. MIDDLE-LEFT — Applications Tracker (table)
   - Columns: Company | Role | Status | Last Event | Next Action | Fit
   - Status badges: applied (gray), interview-1 (blue), interview-2 (blue), rejected (red), offer (green), silent-flag (yellow)
   - Fit score 0-10 colored: 8+ green, 5-7 yellow, <5 red
   - "+ Add Application" button: opens modal with fields company, role, url, applied_date. On submit: GPT fetches/parses URL content, computes fit_score vs user profile, inserts row.
   - "Sync Inbox" button: triggers mock-sync — loads emails from /data/mock_emails.json, GPT classifies each (rejection / interview-invite / follow-up-question / offer / confirmation), finds matching application by company-name, updates status + notes + next_action, animates row updates.

3. MIDDLE-RIGHT — Insights Panel (sticky sidebar)
   - Title: "Patterns"
   - Three AI-generated bullet points based on user-profile + applications + events:
     - Response-rate by role-type
     - Pipeline-velocity per company
     - Strong-fit signals
   - Refresh button to recompute.

4. BOTTOM — VC Jobs Feed
   - Section title: "FA roles you might fit"
   - Loads from /data/vc_jobs.json (15 curated DACH FA-openings)
   - For each: GPT computes fit_score vs user profile + 1-line "why this matches"
   - Top 3 highlighted with subtle border-glow
   - Card layout: company name, role, location, fit-score badge, why-line, "Add to tracker" button

DATA SETUP:
- Supabase tables: users, applications, events, vc_jobs (schema in docs/PRD.md)
- Pre-seed 3 sample applications on first signup: Pedlar (FA, rejected), Avi (Investment Analyst, interview-2), Rust (Operating Associate, applied)
- Load /data/mock_emails.json and /data/vc_jobs.json on first run

KEY INTERACTIONS:
- Onboarding flows naturally — first-time user types into chat, AI clarifies, profile builds in <60 seconds
- "Sync Inbox" is the wow-moment: 3 rows update in animated sequence
- Insights panel updates whenever applications/events change
- Jobs feed re-ranks when profile updates

NO AUTH WALL — let user start typing without signup. Save profile to localStorage initially, sync to Supabase if they sign up via Google.

KEEP IT FAST — every interaction <2s. Use optimistic UI updates.
```

---

## Iterative Refinement Prompts

After initial generation, paste these in order:

1. **"Add a 'Sync Inbox' button at the top of the Applications table. When clicked, loads /data/mock_emails.json, processes each email through GPT to classify and extract company name + status update + next action, then animates 3 rows updating sequentially with 200ms delay between each."**

2. **"In the Insights Panel, generate 3 bullet points that:**
   - **Bullet 1: response-rate analysis (e.g., '3 of 5 B2B-roles responded vs 0 of 3 B2C')**
   - **Bullet 2: pipeline-velocity comparison (avg days-to-first-response)**
   - **Bullet 3: strongest-fit pattern across rejections + interviews**
   **Use the actual applications + events data, not hardcoded text. Recompute when data changes."**

3. **"Make the VC Jobs Feed card-grid (3-column on desktop, 1 on mobile). Sort by fit_score descending. Top 3 cards get a subtle purple glow border. Each card has 'Add to tracker' button that creates an application row with status='applied'."**

4. **"Polish: add a hero-tagline at top: 'Land your first startup role. Track applications, learn what works.' Add favicon. Ensure mobile-responsive."**

5. **"Connect to OpenAI gpt-4o-mini via Lovable's connector for all AI calls (parsing, classification, fit-scoring, insights). Cache results per row to avoid re-running on every render."**
