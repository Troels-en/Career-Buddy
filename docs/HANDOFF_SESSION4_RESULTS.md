# Session D — Coverage expansion results (round 1)

> Session 4, 2026-05-10 night. Sonnet 4.6 (operator note: Opus 4.7
> was active in part, switched mid-flight — see commit author).

## Final lift (post two scrape passes)

| Metric | Baseline (start) | After session D | Delta |
|---|---:|---:|---:|
| Active jobs | 9,980 | **12,504** | **+2,524** |
| Producing companies | 104 | **126** | **+22** |
| `vcs` rows | 209 | 235 | +26 (14 + 9 + 3) |
| `skip_probe=true` | 2 | 60 | +58 (dead-URL noise muted) |
| Backend pytest | 258 | 263 | +5 |

Three real bugs found + fixed in production adapters:

1. **workable/v3 body** — `{"limit": N}` rejected by API → all
   workable scrapes silently zeroed. Fixed: send `{}`.
2. **workable/normalize URL** — v3 jobs payload omits absolute
   URL → `url=""` → CanonicalJob validation fail → 7 huggingface
   jobs quarantined invisibly. Fixed: stash slug at fetch, build
   `apply.workable.com/<slug>/j/<shortcode>/`.
3. **personio/normalize URL** — same shape (XML feed has no
   per-job link). Fixed: stash slug + tld at fetch, build
   `<slug>.jobs.personio.<tld>/job/<id>`.

Run-stats artifact for the final pass:
`artifacts/run-stats-20260510-204635.json` — 804s, 172 vcs, 131
matched, 12,478 valid, **0 invalid**, 1,167 inserted, 11,311
updated.

## What shipped (gap by gap)

### Gap 1 — Broken-VC-adapter audit ✅ partial

| Item | Result |
|---|---|
| Probe CLI | `cli/audit_vc_adapters.py` — async fetch + ATS-pattern scan + classified-recommendation CSV |
| Real bug found | **Workable v3 API rejects `{"limit": N}` body** (HTTP 400 `"limit":"Not allowed"`). Adapter was sending `limit=100` in every POST → every workable scrape silently zeroed. DB had 0 active workable jobs despite Hugging Face + others having open roles. |
| Fix shipped | `ats/workable.py` — body now `{}` on page 1, `{"nextPage": <token>}` on subsequent pages. Two regression tests pin the request-body shape so the next API drift is caught loudly. Live verified: huggingface returns 7 jobs after fix. |
| skip_probe applied | 59 dead-URL VCs (HTTP 404/410 even with browser UA) flagged via `--apply-skip-probe`. `vcs.skip_probe` count went 2 → 61. Orchestrator now skips those on every cycle. `--reasons` flag defaults to `dead_url` only — `no_embed` rows kept live (real producers like Atlassian/HubSpot/Klarna behind JS-rendered SPAs need the existing Gemini fallback, not a static skip). |
| Backend pytest | 258 → 260 |

Audit CSV (gitignored, in `backend/audit/vc_adapter_audit-20260510T195733Z.csv`):

- 59 `skip_probe:dead_url` — applied
- 25 `skip_probe:no_embed` — **not applied**, JS-rendered real producers
- 12 `manual_check` — connection errors / 5xx, leave for retry
- 4 `fix_supported_ats` — investigated:
  - `huggingface.co` → fixed by workable patch
  - `techstars.com`, `holtzbrinck-ventures.com` → genuinely empty
    pipelines (greenhouse/recruitee return 0)
  - `glean.com` → JS-only slug (no static embed); needs Gemini
    fallback or Playwright
- 3 unsupported singletons (`jazzhr`, `smartrecruiters`, `teamtailor`)
  — below the ≥3-VC threshold for adapter expansion

### Gap 2 — VC seed expansion ✅

| Item | Result |
|---|---|
| Approach | Pivot from handoff's pure-VC list (low ROI — orchestrator doesn't walk `portfolio_companies_url` yet) to **DACH/EU operating companies whose `careers_url` surfaces a supported ATS**. Direct ATS-API verification per slug before commit. |
| Seed file | `backend/seeds/dach-eu-supported-ats-2026-05-10.json` (committed; new tracked dir for seeds vs gitignored `artifacts/`) |
| New seeds | 14 inserted: wolt, emnify, nelly, adyen, airbnb, gitlab, pleo, choco, billie, deliveroo, bolt, contentful, contentstack, sanity |
| Repointed | `pitch.com` un-skipped + `careers_url` set to `https://pitch.jobs.personio.de/` (Personio board with 10 jobs) |
| Verified pre-commit job counts | greenhouse 1,071 (wolt 269, adyen 247, airbnb 234, gitlab 187, contentful 113, emnify 15, contentstack 6, pleo 0) · ashby 280 (deliveroo 222, sanity 35, nelly 19, billie 3, choco 1, bolt 0) · personio 10 (pitch) = **+1,371 new jobs unlocked** once next scrape lands |
| `vcs` total | 209 → 223 |

Pure-VC firms from the handoff list (GV, M12, Intel Capital, NVIDIA
Inception, Sapphire, Workday Ventures, Khosla, Tiger Global, GGV) were
**not** seeded. They have no public `careers_url` of their own and
the orchestrator has no portfolio-walking code path. Seeding them
with `careers_url=null` would simply skip them in `_load_vcs_with_careers_url`.
Park until portfolio-walking lands (separate piece of work).

### Gap 3 — Accelerator pipelines ❌ not started

YC + Techstars + Antler + EF + 500 Global + On Deck — 50–100k jobs of
hebel by handoff estimate, but it's a 1-week build per the handoff's
own time estimate. Not started. Notes for next session:

- YC has a public WaaS job board (Work at a Startup). Endpoint is
  documented; treat each YC company as a row in `vcs` with
  `aum_bucket = 'accelerator'` (no migration — the column is
  free-text). Each YC company's actual careers page generally points
  back to greenhouse / lever / ashby (already supported).
- Techstars/Antler/EF/500 follow the same pattern — portfolio page →
  per-company careers → existing adapters.
- The `AtsSource` enum already has `YC_WAAS` and `WELLFOUND` reserved
  (see `models.py`), so no schema work needed for YC.

### Gap 4 — New ATS adapters ❌ not started

Workday is the highest-leverage missing adapter. Confirmed during
audit with live API probes:

- Intel: `intel.wd1.myworkdayjobs.com/wday/cxs/intel/external/jobs` →
  784 jobs.
- NVIDIA: `nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs`
  → 2,000 jobs.
- Salesforce: same shape, 422 on the example body — needs the right
  `appliedFacets` / search params.

Why not shipped tonight:

1. **Schema gap.** `AtsSource` enum (in `models.py`) lacks
   `WORKDAY`. Adding it requires either a migration (if
   `jobs.ats_source` has a check constraint) or just an enum-only
   change (if column is free-text). Needs a 30-min schema audit.
2. **Slug shape.** Existing adapters use a single-string slug; Workday
   needs both `<tenant>` AND `<site_id>` (e.g. `intel/external` vs
   `intel/External_Career_Site`). Requires either a slug-encoding
   convention (`tenant/site_id`) or a wider adapter signature change.
3. **Site_id discovery.** Most companies' Workday URL has a non-
   obvious site_id (`External_Career_Site`, `NVIDIAExternalCareerSite`,
   `External`). Static-HTML probe captures it; need to wire that into
   `discovery.py`.
4. The handoff itself estimates 3–5 days per adapter. Hard rule
   (`feedback_scraper_systematic_fixes.md`) says "no adapter ships
   without test coverage" — five fixtures per adapter.

Realistic next-session ship order: Workday → Personio (already
exists; just needs DACH seed input) → SmartRecruiters → JOIN.com →
BambooHR.

### Gap 5 — Job aggregators ❌ not started, by design

Per handoff: "Only ship after Gaps 1–4 land".

## Commits stacked on `main`

```
973aff3 feat(scraper/audit): --apply-skip-probe flag with reason allow-list
fee5f1d fix(scraper/workable): drop {"limit":N} body — v3 API rejects it
c1cb5ac feat(scraper/seeds): Gap 2 — DACH/EU producers on supported ATS
8c1987a docs(coord): register session D — scraper coverage expansion
```

(`8c1987a` is the clean re-do of the bad bundled commit `1ed7033` that
got pushed before the split-fix. Coord row is already on remote via
`1ed7033`; `8c1987a` is the local-only clean version that was kept
after `git fetch + reset --soft origin/main`.)

## Push status

`Bash(git push origin main)` is **not** in `.claude/settings.local.json`
despite the handoff claim "it currently is". Commits are local
pending the user running `! git push origin main` or adding the
durable rule.

## What the user should do next

1. `git push origin main` (ships the 4 commits).
2. Wait for scrape to fully apply seeds + workable fix → check
   `cd backend && uv run python -c "from career_buddy_scraper.db import connect; ..."`
   → expect `producing companies` to climb from 104 → ~118 and
   `active jobs` from 9,980 to ~11,360.
3. Pick up Gap 3 (YC pipeline) or Gap 4 (Workday adapter) in a fresh
   session — they're both Sonnet-4.6 jobs.
