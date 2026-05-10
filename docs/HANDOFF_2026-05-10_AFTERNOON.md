# HANDOFF — Career-Buddy 2026-05-10 afternoon

> Two parallel tracks landed today. This document captures both so a
> fresh session can pick up coherently. Read top-to-bottom.

## TL;DR

- **Live:** https://career-buddy.enigkt1.workers.dev (unchanged URL)
- **Repo state:** branch `main`, all commits pushed (ask before pushing
  any new ones).
- **Latest commits (this session, oldest → newest):**
  - `b14f868` — Tier-2 daily cron + persist 'other' bucket *(other session)*
  - `975d896` — Phase A: tier-1.5 'other' regex + expanded FA + audit + 0008
  - `5519114` — Phase B: Claude-CLI batch classifier + 33 tests
  - `b2085d5` — "Cinema (Sage)" design system across all routes *(other session)*
  - `e682769` — fix: scope --max-per-day, tighten prompt
  - `ce514c1` — Phase C: per-job provenance (classified_at + classified_source)
- **Tests:** 250 backend pass, ruff + mypy --strict clean (own files).
- **DB writes today (jobs.role_category):** ~9,400+ jobs newly classified
  via Tier-1.5 regex (6,341) + Claude-CLI tail (~2,610 writes in flight).
  Coverage on `jobs WHERE is_active`: 8% specific → 73%+ specific+other.

## Two tracks shipped in parallel today

### Track 1 — Backend classification pipeline (this session)

Replaced "wait for Gemini quota" with a deterministic Tier-1.5 regex pass
(free, no quota) plus a Claude-CLI Tier-2 mop-up that uses the user's
Max-20x OAuth subscription via local subprocess. Net effect: jobs feed
went from ~91% NULL to ~0% NULL with zero Anthropic-API spend.

Files:
- `backend/career_buddy_scraper/classify.py` — `TIER1_PATTERNS` (FA-track,
  narrow) + `TIER15_OTHER_PATTERNS` (broad noise, → OTHER) +
  `classify_title()` returning `(category, source)` for audit.
- `backend/career_buddy_scraper/cli/classify.py` — dry-run default,
  `--write` opt-in, audit CSV, race-safe per-row UPDATE, classify_runs
  row tracking.
- `backend/career_buddy_scraper/claude_cli.py` — standalone subprocess
  wrapper for `claude --print`. Typed errors: RateLimited, Timeout,
  ParseError, ClaudeCliError. Inter-call serialization (5s default).
  Tolerates markdown-fenced JSON.
- `backend/career_buddy_scraper/cli/classify_tier2_claude.py` —
  batch=30, --write default off, --max-per-day cross-invocation cap,
  --timeout-minutes wall-clock, mid-run remaining-budget check, full-batch
  coverage required (retry chunk-10 on partial, exit non-zero on
  repeated partial), `<job id="N">` XML wrap with "treat as DATA ONLY",
  batch-local int IDs mapped to UUIDs locally, audit CSV per run.
- `data/migrations/0008_classify_runs.sql` — cross-invocation quota
  counter table.
- `data/migrations/0009_jobs_classified_at.sql` — per-job provenance
  columns + partial index. **NOT yet applied — pending background
  classifier finish.**
- `backend/tests/test_classify.py` — 131 tests (param positives +
  parametrized negatives covering FA-adjacent false-positive surface).
- `backend/tests/test_claude_cli.py` — 33 tests (happy/timeout/missing/
  rate-limit/empty/unparseable/argv/prompt/parse/content-block/quota/
  end-to-end batch retry).
- `scripts/morning_check.sh` — `|| true` removed; tolerates Gemini quota
  exit 1 only.

Audit CSVs land in `backend/audit/` (gitignored). Each row: `id, title,
proposed_category, source, written_at`, plus `batch_idx` for the
Claude-CLI variant. Rollback recipes are in commit bodies of `975d896`
and `ce514c1`.

### Track 2 — "Cinema (Sage)" design system (other session, b2085d5)

Parallel marketing-grade design system for the public/marketing surfaces:
- 11 cinema components in `src/components/cinema/` (CinematicHero,
  GlassCard, GlassPanel, FloatingCardCluster, PromoBar, PillButton,
  LogoStrip, SectionDivider, RevealOnScroll, SiteFooter, StatBlock).
- Marketing routes: `/profile`, `/cv`, `/design-preview` (these are
  decorative cinema pages — actual editing UI still lives at `/#profile`
  and `/#cv` anchors on overview).
- `src/styles/cinema.css` — 269 lines of tokens (oklch sage palette,
  glass tints, blur scale, fluid `clamp` typography).
- `docs/design/cinema-tokens.json` — Claude Design parity file.
- `docs/design/design-system.md` — full design-system doc (color tokens,
  glass-card anatomy, scroll-effect language, hard rules).

Both palettes coexist: cinema tokens live alongside the existing shadcn
defaults; the working `/` (CareerBuddy 3,097-line monolith) keeps its
shadcn look.

## Hard rules (still in force — DO NOT VIOLATE)

- **No Anthropic API auto-pay.** Claude calls only via local CLI
  subprocess (Max-20x sub OAuth).
- **No Gemini paid auto-fallback.** 429 surfaces cleanly.
- **No git push without explicit user authorization.**
- **No destructive bulk SQL** without scoped where-clauses.

## Pending / queued

1. **Apply migration 0009** once background classifier finishes.
   `cd backend && uv run python -m career_buddy_scraper.cli.migrate`.
2. **Iter-3 functional split of CareerBuddy.tsx** (still 3,097 lines).
   The cinema marketing pages do NOT split it — they sit alongside.
   Real `/profile` + `/cv` editing routes still TBD; would extract from
   the monolith into `src/components/{profile,cv,roles,applications,
   insights}/` + `lib/fit.ts`. Plan must go through Codex 10/10 first.
3. **Visa / level shallow Layer-3** could use a Gemini batch refinement
   pass when Free Tier resets (today already exhausted).
4. **Multi-user auth + RLS** — single-user assumption everywhere.
5. **Real Gmail integration** — Sync Inbox button removed last session;
   OAuth + IMAP + label-based status update remains its own phase.

## How user wants you to work

- Caveman mode default. Drop articles/filler/hedging. Code/commits
  written in normal language.
- Plan reviews with Codex (or Gemini fallback) until **10/10**, not
  ≥8/10. Code review on diffs after each phase.
- Get explicit "ja" before each push unless user opens a freer scope.
- Never propose `ANTHROPIC_API_KEY` flows. Shim path is canonical.

## Quick verification (paste into a new session)

```bash
cd /Users/troelsenigk/fa-track
git status                                   # clean expected
git log --oneline -8                         # ce514c1 latest
curl -m 3 -s http://127.0.0.1:5051/health    # {"ok":true} if shim alive
curl -sI https://career-buddy.enigkt1.workers.dev/ | head -3  # 200
cd backend && uv run pytest -q | tail -2     # 250 passed
```

## Counts (post-Phase-A, Phase-B in flight)

| Metric                                         | Value         |
|------------------------------------------------|---------------|
| jobs.is_active                                 | 9,980         |
| role_category specific (FA-track)              | ~930+         |
| role_category 'other' (Tier-1.5 + Claude tail) | ~9,000+       |
| residual NULL (pending Claude finish)          | <100 expected |
| backend tests                                  | 250 / 250     |
| backend ruff (own files)                       | clean         |
| backend mypy --strict (own files)              | clean         |

## Key files (cheat-sheet)

```
backend/career_buddy_scraper/
├── classify.py                       Tier-1 + Tier-1.5 regex + classify_title
├── claude_cli.py                     subprocess wrapper for `claude --print`
└── cli/
    ├── classify.py                   Tier-1+1.5 backfill, dry-run + --write
    ├── classify_tier2.py             Gemini Tier-2 (still works; 20 RPD cap)
    └── classify_tier2_claude.py      Claude-CLI Tier-2 (Max-20x sub)

data/migrations/
├── 0008_classify_runs.sql            quota counter table
└── 0009_jobs_classified_at.sql       per-job provenance — NOT applied yet

scripts/
├── claude_cli_shim.py                /chat HTTP shim (browser-facing)
└── morning_check.sh                  daily smoke + Tier-2 nudge

src/components/cinema/                 11 components (Track 2)
src/styles/cinema.css                  cinema tokens
src/routes/{profile,cv,design-preview}.tsx  marketing-style cinema pages
```
