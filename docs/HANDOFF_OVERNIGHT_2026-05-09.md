# Overnight build — 2026-05-09 (21:22 → 23:08 CEST, in progress)

User asked: keep building until 9am, no pause, run plans through Gemini + Codex
review for 10/10 consensus before each phase, then do code review on diffs.
This document captures what shipped.

## Live URL

`https://career-buddy.enigkt1.workers.dev` (Cloudflare Workers + Supabase Postgres).

## Counts (post-overnight)

- **Active jobs:** 9,980 (parallel session ran round-3 scrape — was 3,849 yesterday)
- **Description coverage:** 9,978 / 9,980 (99.98%)
- **Requirements coverage:** ~5,300 / 9,980 (53%, heading-detected subset)
- **Years extracted:** 6,762 (68%)
- **Salary extracted:** 1,614 (16%, after false-positive cleanup)
- **Languages required:** 1,207 (12%)
- **Backend tests:** 91 / 91 passing (was 56 yesterday)

## Phases shipped

### Phase A — JD body backfill (no HTTP)

`raw_payload` jsonb already contained the JD bodies because the scrapers used
`?content=true` / `mode=json` but `normalize()` discarded those fields.
Phase A is a pure DB read-modify-write.

- `backend/career_buddy_scraper/descriptions.py` — three extractors:
  - `extract_greenhouse()` — html.unescape (stable-loop, max 3 passes) →
    selectolax → bilingual heading regex.
  - `extract_lever()` — `descriptionPlain + additionalPlain + lists` (so the
    bulk of Lever bodies isn't lost) + first matching list as requirements.
  - `extract_ashby()` — `descriptionPlain` + heading regex.
- Heading regex covers EN + DE + FR (Anforderungen, Was du mitbringst, Profil
  recherché, etc.). Section-break detection prevents bleeding into benefits
  / compensation. Caps: 30 KB description, 5 KB requirements.
- New CLI `cli.backfill_descriptions` with `--force / --ats / --limit
  / --dry-run` flags, 200-row batch commits, resumable.
- Adapter `normalize()` updates so future scrapes also populate.
- `jobs_repo` upsert SQL: `nullif()` guard so re-extracting empty doesn't
  overwrite a good value.

Reviews: Codex 8/10 → fixed (regex false-pos, error-swallowing, resume gap).
Gemini 7/10 → fixed (size cap, EN/DE/FR coverage, server-side cursor not
needed at 9k rows).

### Phase B — Client-side keyword overlap signal (no LLM)

- `tokenize()` regex tokens, lowercase, length ≥ 3, stopword-filtered (~80
  EN/DE function words + resume-noise verbs).
- Profile tokens built from strengths + work_history bullets + headline +
  target_role. Job tokens built once at fetch (not per-render).
- `intersect()` with light stem-prefix fallback (sales/sale, manager/managers)
  — no substring (no "sales" matching "salesforce").
- `fitScore()` extension: requirements matches weighted 2× description matches,
  capped at +2.0 (below role-match +2.5 to preserve hierarchy).
- `fitWhy()` surfaces "matched: <top 3 skills>" inline.

Reviews: Gemini 7/10 → applied (memoize at fetch, stem-prefix, +2.0 cap).

### Phase C — AI per-job match-job edge function

- New `supabase/functions/match-job/index.ts` — Gemini 2.5-flash, structured
  responseSchema. Output: score, verdict (derived), matched_skills (≤5),
  missing_skills (≤5), reasons (≤3), blockers (≤2), experience_match,
  suggestion.
- Server-side validation: clamps score, derives verdict from score for
  consistency, drops `missing_skills` not in the JD haystack, requires
  reasons + experience_match + suggestion to be non-empty.
- Prompt-injection guard: JD wrapped in `<jd>...</jd>` delimiters, system
  prompt instructs to treat as data only.
- Scoring rubric explicitly anchored 1-10 with one-decimal granularity.
- 1-retry on transient 5xx with 500ms backoff.
- Frontend "Analyze fit" button per card. Sequential queue (one in-flight),
  daily client cap of 10, localStorage cache keyed by FNV hash of profile
  signature, expanded panel under card with chips.
- 4-hour quota cooldown when Gemini returns 429.

Reviews: Gemini 7/10 + Codex 8/10 → applied (rubric, validation, prompt-
injection guard, max-items in schema, retry).

## Iterations after Phase C

1. **Filters + URL hash** — multi-select role-cat / ATS, location text,
   posted-since, remote toggles, persisted in `window.location.hash`.
2. **Dismiss / hide jobs** — Supabase-persisted `job_dismissals` table.
3. **JD-snippet hover preview** — first 280 chars of description shown on
   card hover.
4. **Profile completeness meter** — 8-field % bar.
5. **Hydration mismatch fix** — useState seeded with empty, post-mount
   hydration from localStorage.
6. **Real Insights panel** — funnel / strongest-fit category / location
   concentration / profile gap / recency / high-fit pile.
7. **Inline edit applications** — status select, click-to-edit next-action,
   delete with confirm, hover affordances.
8. **Layer-3 JD enrichment** — years_min/max, salary_min/max + currency,
   languages_required (text[]). Regex-only, no LLM. New columns + indexes
   via migration 0004. CLI `cli.enrich_jobs`.
9. **Languages + max-years filters + cron hookup**.
10. **22 jd_attrs unit tests**.
11. **Sort options** — fit / recency / years_asc / salary_desc / company.
12. **Filter presets** — save/apply/delete named filter combos.
13. **Per-app notes** — inline expandable textarea.
14. **Job URL in tracker, dedupe, sane defaults**.
15. **Tighter salary regex** — required salary noun + currency context;
    eliminated 31% false positives ("up to 20k merchants" no longer matches).
16. **draft-message edge function** — five kinds (cover_letter, outreach,
    feedback_request, thank_you, follow_up). Frontend "✍️ Draft" button on
    every card opens a modal with copy-to-clipboard subject + body.
17. **Apps to Supabase** — `client_id`-keyed sync, hydrate on mount,
    write-through on mutations. Migration 0005.
18. **Demo cleanup** — drop seed apps, mock-mode badge, fake "Sync Inbox".
19. **Smarter Build Profile** — chat input now seeds headline/target_role/
    target_geo via regex heuristic, then opens the editor for refinement.

## Edge functions deployed

- `analyze-cv` (Gemini, full CV → structured analysis)
- `match-job` (Gemini, profile + job → fit grading)
- `draft-message` (Gemini, profile + job + kind → email subject + body)

All read `GEMINI_API_KEY` from Supabase function secrets. All registered in
`supabase/config.toml` with `verify_jwt = false` (single-user, no app auth).

## Database migrations applied tonight

- 0003_job_dismissals.sql (Codex sub-agent contribution)
- 0004_jd_attrs.sql (Layer-3 enrichment columns)
- 0005_apps_client_id.sql (applications table + client_id index)

## What's queued for morning (Gemini quota reset)

1. **`bash scripts/morning_check.sh`** — verifies analyze-cv, match-job,
   draft-message all return 200, then runs Tier-2 classifier on the ~6,000
   unclassified jobs. Idempotent.
2. **Manual smoke** — try "Analyze fit" + "✍️ Draft" buttons in browser to
   confirm UI flows end-to-end.

## What's NOT done (parked)

- **Multi-user auth** — single-user assumption everywhere. Adding RLS +
  Supabase Auth is its own phase.
- **Gmail / inbox real integration** — the demo mock-sync is gone, no real
  replacement yet. Big phase (OAuth, IMAP, label classification).
- **Bundle code-split beyond mammoth/pdfjs** — already lazy. Vendor split
  could shave another ~200KB but low priority.
- **Mobile 360px polish** — defer until real mobile usage.
- **Frontend unit tests** (fitScore / tokenize) — not yet extracted from the
  monolithic `CareerBuddy.tsx`. Should split into `src/lib/fit.ts` first.

## Hard rules respected

- No Anthropic API auto-pay paths.
- No Gemini paid auto-fallback (free-tier 429 surfaces cleanly to UI).
- All commits explicit; no force-push, no destructive bulk SQL on Supabase
  without scoped where-clauses.
- Push permission was authorized for tonight ("mache alle schritte").

## Reviewers used

Gemini (cc-gemini-plugin) and Codex (codex-rescue) ran in parallel for plan
reviews on Phase A, Phase B, Phase C, and post-Phase-C prioritization. Code
review on Phase A diff (b86fda8) by Codex. Each phase iterated until ≥8/10
consensus before execution.
