# Career-Buddy

> Land your first startup role. Track applications, learn what works, find roles that fit.

> **Monorepo as of 2026-05-09.** Frontend (Lovable / TanStack Start) lives at the repo root. Python backend (Layer-1 scraper) in [`backend/`](backend/). Both share the same Supabase project via [`data/migrations/`](data/migrations/). Bidirectional Lovable ↔ GitHub sync expects the frontend at root, which is why the layout is asymmetric (frontend at root, backend in a subdir).

**ICP:** Business-background grads (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU) with 0–2y exp who want to break into early-stage startups via **Founders Associate / BizOps / Strategy / BD** roles. Not engineering. Not senior.

**The Pain:**
- 30+ FA-roles posted across VC career-pages, startup careers, LinkedIn-stealth, Antler/EF cohorts
- No central tracker — every application leaves traces in Gmail, LinkedIn-DMs, WhatsApp, Notion
- You forget who you applied to, when to follow up, what got responses
- No self-knowledge layer: which role-types respond, which don't, why
- Tools like Clera (Junior-Job-Board) have WhatsApp-chat that forgets you sent a CV — dumb

**Long-term Vision (Layer 1–3):** see [`docs/PRD.md`](docs/PRD.md). End-state = persistent **Career Buddy** with context-flywheel-moat: app remembers everything about your career, advises on switching, salary negotiation, headhunter-connect, growth-recommendations.

## Repository layout

```
.
├── package.json                  TanStack Start + Vite frontend (Lovable)
├── vite.config.ts                Vite config
├── wrangler.jsonc                Cloudflare Workers deploy
├── tsconfig.json
├── components.json               shadcn-ui config
├── public/                       static assets + mock data fixtures
├── src/
│   ├── routes/                   TanStack file-based routes
│   ├── components/
│   │   ├── CareerBuddy.tsx       main app
│   │   └── ui/                   shadcn primitives
│   ├── integrations/supabase/    Supabase client (server + browser)
│   └── lib/                      utilities (cv-parser, error capture)
├── supabase/
│   ├── config.toml
│   └── functions/analyze-cv/     Edge Function — CV analysis
├── backend/                      Python 3.11 + uv Layer-1 scraper
│   ├── pyproject.toml
│   ├── career_buddy_scraper/
│   │   ├── ats/                  Greenhouse, Lever, Ashby, Workable, Personio,
│   │   │                         Recruitee, Gemini-fallback adapters
│   │   ├── cli/                  scrape, classify, classify_tier2, discover_slugs,
│   │   │                         migrate, preflight, report, seed_notion
│   │   ├── sources/              Notion-export loader
│   │   ├── http.py               RateLimitedClient (token bucket + cache)
│   │   ├── orchestrator.py       per-VC fetch → normalize → validate → upsert
│   │   ├── jobs_repo.py          Postgres upsert + mark-stale
│   │   ├── master_list.py        VC dedupe + upsert
│   │   ├── models.py             Pydantic schemas
│   │   ├── classify.py           Tier-1 regex
│   │   └── gemini_scraper.py     Free-tier LLM extractor
│   └── tests/                    56 tests, ruff clean, mypy strict clean
├── data/
│   ├── schema.sql                legacy single-shot baseline
│   └── migrations/               canonical migration history
├── docs/
│   ├── brief.md / build.md / design.md           specs
│   ├── PRD.md / DEMO.md                          long-form
│   ├── LOVABLE_PROMPT.md / refinement-prompts.md Lovable instructions
│   ├── scraper-plan.md                           Layer-1 architecture
│   ├── HANDOFF_GEMINI_SCRAPER_2026-05-09.md      hand-off note
│   └── decisions/                                ADRs (0001–0004)
├── artifacts/                    gitignored — runs, reports, caches
├── .env.example                  shared env (backend + frontend Supabase keys)
└── .gitignore
```

## How frontend and backend connect

Both layers talk to **one Supabase Postgres project**:

- **Backend** (`backend/career_buddy_scraper/`) writes to `vcs` and `jobs` via the migration runner + Layer-1 scraper.
- **Frontend** (`src/`) reads from `vcs` and `jobs` (and writes to `users`, `applications`, `events` for end-user actions) via the Supabase JS client.
- **Edge Functions** (`supabase/functions/`) sit between when CPU-bound work needs to run server-side (CV analysis).
- No backend → frontend network call. Supabase is the API boundary.

## Frontend setup

```bash
bun install                       # or npm install
cp .env.example .env              # fill in VITE_SUPABASE_* keys
bun run dev                       # vite dev server
```

## Backend setup

```bash
cd backend
uv sync                           # install Python deps
uv run pytest                     # 56 tests
uv run python -m career_buddy_scraper.cli.scrape   # live scrape
```

## Roadmap

- [x] Layer 0 — Hackathon MVP (mock-mode demo at Lovable Future Founders Series 2026-05-07)
- [x] Layer 1 — Real Gmail-OAuth + LinkedIn-sync + VC-scraper (3849 jobs live in Supabase)
- [ ] Layer 2 — CV-Coach + Cover-Letter + Interview-Prep + Growth-Recommender
- [ ] Layer 3 — Career Buddy (full vision: switch-timing, salary-negotiation, headhunter-broker, life-stage-aware)

## Project documentation

| File | Purpose |
|---|---|
| [`docs/brief.md`](docs/brief.md) | Product brief: problem, primary user, core job, success criteria |
| [`docs/build.md`](docs/build.md) | Build scope, phased priority, screens, features, acceptance criteria |
| [`docs/design.md`](docs/design.md) | Visual direction, design tokens, motion |
| [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) | Stable project knowledge for Lovable's project memory |
| [`docs/LOVABLE_PROMPT.md`](docs/LOVABLE_PROMPT.md) | Canonical initial-generation prompt for Lovable |
| [`docs/refinement-prompts.md`](docs/refinement-prompts.md) | Iterative prompts to fix specific Lovable misfires |
| [`docs/project-knowledge.md`](docs/project-knowledge.md) | The Project Knowledge prompt to paste into Lovable settings |
| [`docs/scraper-plan.md`](docs/scraper-plan.md) | Layer-1 VC + portfolio scraper architecture |
| [`docs/HANDOFF_GEMINI_SCRAPER_2026-05-09.md`](docs/HANDOFF_GEMINI_SCRAPER_2026-05-09.md) | Gemini scraper hand-off note |
| [`docs/PRD.md`](docs/PRD.md) | Long-form PRD covering Layers 0–3 |
| [`docs/DEMO.md`](docs/DEMO.md) | Demo script / talk track |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records (ADRs) — see [the index](docs/decisions/README.md) |

## License

MIT — see [LICENSE](LICENSE).
