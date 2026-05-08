# project-knowledge.md — Career-Buddy

> **Lovable convention (per Iglika's Future Founders Build Guide):** paste the block below into Lovable's **Project Knowledge** setting (Project settings → Project knowledge). It tells Lovable HOW to use the docs in this repo. Set it once; Lovable follows it across every message in the project.
>
> **Promo code (from the Future Founders Build Guide):** `COMM-FOUNDER-ZREQ` — 1 month of Lovable Pro for free.

---

## Project Knowledge prompt (paste into Lovable settings)

```
You are building Career-Buddy — a Founders-Associate / startup-entry-role application tracker for business-background graduates (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU, ESCP, RSM, Bocconi, IE) chasing their first non-engineering startup role.

This is a 2-hour hackathon demo running in MOCK MODE: no live API calls, no LLM connectors, no API keys, no Supabase Auth, no real email sync, no real PDF parsing. All "AI" output is deterministic, hardcoded or read literally from /data/mock_emails.json and /data/vc_jobs.json. Persist app state to localStorage (key "career-buddy-state"). React + Tailwind only.

This project has four planning documents in the /docs folder. Read all four before making any changes:

- /docs/brief.md — the product brief: problem, primary user, core job, what makes it better, vision, success criteria, out-of-scope. Always check this before adding or changing any feature.
- /docs/design.md — the visual direction and design tokens: mood, palette, typography, status badges, spacing, motion, UX principles, layout grid. Always check this before making any styling decisions.
- /docs/build.md — the build order and scope for v1: stack, hard constraints, phased priority (Phase 1/2/3), screens, user flows, feature specs, acceptance criteria, build order. Always check this to understand what's in and what's explicitly out of scope.
- /docs/LOVABLE_PROMPT.md — the canonical initial-generation prompt with full implementation detail. Treat it as the source of truth when build.md is silent on a UI specifics.

Rules:
1. If I ask you to add a feature that isn't in brief.md and build.md, flag it and ask me first before building it.
2. If I ask you to change something visual that conflicts with design.md, flag it and ask me first.
3. Never invent strings the user will see. Every visible string must come from the docs or the JSON fixtures.
4. Never reference OpenAI, Anthropic, GPT, Claude, or any LLM provider in app UI, code comments, variable names, or user-facing strings — except the visible mock pill "Mock AI mode · cached demo responses".
5. Never write to Supabase at runtime. localStorage is the source of truth for v1.
6. When the build is not converging cleanly, drop Section 4 (VC Jobs Feed) first, then Section 3 (Insights). Never drop Section 2's Sync Inbox — it is the demo's single most important feature.
7. When generating supporting documentation, decisions, or change-logs, save them as .md files under /docs/ — not inside React components. Use kebab-case filenames.
8. When in doubt, read the docs before acting.
```

---

## How the docs fit together

| File                          | Purpose                                                | Changes when                              |
|-------------------------------|--------------------------------------------------------|-------------------------------------------|
| `brief.md`                    | Problem, user, vision, success criteria, scope         | Strategy / positioning shifts             |
| `design.md`                   | Visual & UX direction, tokens, motion, principles      | Brand or design system changes            |
| `build.md`                    | Stack, scope, phased order, screens, features, AC      | Feature spec or build order changes       |
| `project-knowledge.md` (this) | The Project Knowledge prompt for Lovable settings      | When the doc structure itself changes     |
| `LOVABLE_PROMPT.md`           | Canonical initial-generation prompt (build spec only)  | Implementation details / canonical tweaks |
| `refinement-prompts.md`       | Iterative tweaks to fix specific Lovable misfires      | Add new tweaks as they're discovered      |
| `PRD.md`                      | Long-form PRD (Layer 0–3 vision, schema, pricing)      | Long-term roadmap shifts                  |
| `DEMO.md`                     | Demo script / talk track for the hackathon walkthrough | Demo narrative changes                    |
| `PROJECT_CONTEXT.md`          | Enriched project context (legacy supplement to brief)  | Will fold into brief.md long-term         |

---

## Setup steps

1. Open Lovable. Switch to **Plan Mode**.
2. Go to **Project settings → Project knowledge**.
3. Paste the prompt block above (replacing nothing — it is already filled in for Career-Buddy).
4. Save.
5. Open a new chat in Plan Mode and paste the contents of `/docs/LOVABLE_PROMPT.md` as the initial generation prompt.
6. Lovable will read `/docs/brief.md`, `/docs/design.md`, `/docs/build.md` before each change.
7. If Lovable misfires on a specific part (Sync stagger, top-3 glow, mock pill, etc.), use the targeted prompts in `/docs/refinement-prompts.md` rather than re-generating from scratch.

---

## Reference: Iglika's Future Founders Build Guide (07.05)

Source: https://iglikamd.notion.site/Future-Founders-Build-Guide-07-05-358ea2843e06805baf50c59c0bc74b5d

Key takeaways applied here:

- **Step 1 (Clarify your idea).** Done — `brief.md` carries the problem statement, primary user, core job, and what makes it better.
- **Step 2 (Set up project documentation).** Done — `/docs/brief.md`, `/docs/design.md`, `/docs/build.md` follow the convention exactly.
- **Step 3 (Set up Project Instructions).** Done — see the prompt block above. Paste into Lovable's Project Knowledge.
- **Step 4 (Mini design system from screenshots).** N/A for v1; `design.md` already has full tokens. If new screenshots arrive later, run the screenshot-extraction prompt from the guide and update `design.md`.
- **Step 5 (Adding AI features).** Skipped — Career-Buddy v1 is mock-mode only. No LLM connectors. The `$1` AI credit limit on Lovable's free month is irrelevant.
- **Step 6 (Set up your database).** Skipped — `localStorage` is the source of truth. Supabase tables exist in the repo schema for Layer 1+ but are not used at runtime.
- **Step 7 (Publish).** When ready, click Publish in Lovable. Default `.lovable.app` subdomain is fine for the demo.
