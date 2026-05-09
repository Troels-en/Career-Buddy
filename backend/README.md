# Career-Buddy Layer-1 Scraper

Daily-refreshed database of operator / FA / BizOps / Strategy / BD / Chief-of-Staff jobs at VCs and their portfolio companies. Replaces the hardcoded `data/vc_jobs.json` fixture used in Layer 0.

Architecture lives in [`docs/scraper-plan.md`](../../docs/scraper-plan.md). Language + tooling decision in [ADR 0003](../../docs/decisions/0003-python-uv-scraper.md).

## Quickstart

```bash
cd backend
uv sync                  # install dependencies into .venv
uv run pytest            # run tests
uv run ruff check .      # lint
uv run ruff format .     # format
uv run mypy career_buddy_scraper  # type-check
```

## Apply database migrations

Migrations live in `../../data/migrations/`. Source-of-truth is the live
Career-Buddy Supabase project (`SUPABASE_DB_URL` in repo-root `.env`).

```bash
uv run python -m career_buddy_scraper.cli.migrate            # apply all pending
uv run python -m career_buddy_scraper.cli.migrate FILE.sql   # apply one file
```

Migrations are tracked in a `_migrations` table inside Supabase, so re-runs
are no-ops. See [`docs/decisions/0004-supabase-as-source-of-truth.md`](../../docs/decisions/0004-supabase-as-source-of-truth.md) for the rationale.

## Phases (per `docs/scraper-plan.md`)

- **Phase A** — VC master list. Pull OpenVC + EU-Startups + Signal NFX, dedupe by domain, manual tier classification, capture `careers_url`. Upsert into Supabase `vcs` (JSON export at `data/vc_master_list.json` is optional cache).
- **Phase B** — VC career-page scraper. Build adapters for Greenhouse, Lever, Ashby, Workable. Detector picks ATS per `careers_url`. Daily cron writes to Supabase `jobs` table.
- **Phase C** — Portfolio scraper. For each VC, scrape its portfolio page → `portfolio_master_list.json`, then run the same ATS adapters across portfolio companies.
- **Phase D** — Categorization. Tier-1 regex filter for operator-track titles, Tier-2 LLM classifier for ambiguous cases.
- **Phase E** — Frontend integration. Replace `data/vc_jobs.json` fixture with Supabase query in the Lovable build.
- **Phase F** — Layer-1.5 expansion (YC Work-at-a-Startup, Wellfound, EU-Startups job board, HN "Who's hiring").

## Layout

```
backend/
├── pyproject.toml
├── README.md (this file)
├── career_buddy_scraper/
│   ├── __init__.py
│   ├── models.py            # Pydantic schemas mirroring data/schema.sql
│   ├── ats/                 # one adapter per ATS provider
│   │   ├── __init__.py
│   │   ├── base.py          # detect/fetch/normalize protocol
│   │   ├── greenhouse.py
│   │   ├── lever.py
│   │   ├── ashby.py
│   │   └── workable.py
│   ├── master_list.py       # VC master list builder (Phase A)
│   ├── classify.py          # Tier-1 regex + Tier-2 LLM (Phase D)
│   └── cli.py               # entry points: build-master-list, scrape, classify
└── tests/
    ├── conftest.py
    ├── test_ats_greenhouse.py
    ├── test_ats_lever.py
    ├── test_ats_ashby.py
    └── test_ats_workable.py
```

## Politeness

- Max 5 concurrent requests per ATS provider.
- 200ms delay between requests to the same domain.
- `User-Agent: Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)`.
- Cache ATS responses for 4h locally.
- Respect `robots.txt` for non-API custom scrapes.
- LinkedIn / Wellfound: official APIs only. No scraping.
