# HANDOFF — Career-Buddy new BACKEND session (2026-05-10 evening, round 7+)

> Drop into a fresh chat. Read this top-to-bottom before doing anything.
> Two parallel Claude Code sessions are active in this repo today; this
> handoff hands the **backend + tooling** baton to a new session. The
> **UI session** (route components, cinema chrome, ThemePicker, etc.)
> stays running and continues its own workplan — see
> `docs/HANDOFF_UI_2026-05-10_evening.md` for what UI is doing.
>
> **Re-read this doc + `CLAUDE_COORDINATION.md` after any context
> compaction.** Both files are the source of truth.

## TL;DR

- **Live:** https://career-buddy.enigkt1.workers.dev
- **Repo root:** `/Users/troelsenigk/fa-track`. Branch `main`.
- **Last commit on origin/main:** `e07e0f2` (this hand-off doc — see
  `git log` for actual head when you pull).
- **Tests:** 244 frontend (vitest + RTL), backend 258 (pytest).
- **Builds:** `bun run build` green; `bun run test` green;
  `bun run test:e2e` green; `bunx tsc --noEmit` green except one
  pre-existing Supabase upsert error in `CareerBuddy.tsx:501` (will
  shift as you extract more).
- **Push permission:** `Bash(git push:*)` whitelisted in
  `.claude/settings.local.json` — no per-push prompts.

## Two-session model

| Session | Owner area | Status |
|---|---|---|
| **A — UI session** (continues running) | `src/routes/*`, `src/components/cinema/*`, `src/components/profile/*` (component code, not tests), `public/sw.js`, design docs, photography, Phase 4 themes, Email/Theme picker UIs | Phase 4 complete (4 themes shipped). Idle pending the CV-profile-Supabase wire (waits on B's tasks 1–6 in this doc) + Phase 3 jobs-extraction. |
| **B — Backend + tooling session** (you, new chat) | `backend/career_buddy_scraper/*`, `data/migrations/*`, `supabase/migrations/*`, `supabase/functions/*` (with announce), `src/integrations/supabase/types.ts`, vitest + playwright config, `src/lib/*` extraction, RTL tests for UI-owned components | Phase 1 lib extraction COMPLETE (12 modules + 244 tests). Foundation done. Remaining backend work below — CV-profile-Supabase tasks are HIGHEST priority because A is blocked on them. |

**Boundary truth:** `CLAUDE_COORDINATION.md` in repo root — read it first.
The owner-map there overrides this doc if conflicts arise.

## What landed in this hand-off ancestry

The session that just finished (B / backend + tooling) shipped, in order:

```
4bf0c23  refactor(lib): TRACKS catalogue → src/lib/tracks.ts
96e3152  refactor(lib): STORAGE_KEY + Profile shape → src/lib/cv-storage.ts
0acc46a  refactor(lib): job-fit scoring + token utils → src/lib/job-fit.ts
ea184ca  refactor(lib): job-feed filters + sort → src/lib/job-filters.ts
c0a2214  feat(lib): profile-store bridge — sync /profile track+years
e5c8d88  feat(db): 0010 user_email_accounts (Phase 1.5 Email integration)
404f942  feat(db): 0011 user_tracks (Phase 4 step 3 theme wiring)
639365d  refactor(lib): formatting helpers → src/lib/format.ts
33d083f  refactor(lib): misc job/profile helpers → src/lib/jobs-helpers.ts
03994a5  test(profile): RTL coverage for CvUploadInline
13af330  refactor(lib): filter-presets storage → src/lib/filter-presets.ts
92c75c8  refactor(lib): match-cache + quota storage → src/lib/match-cache.ts
6982329  refactor(lib): rich-state types + state helpers → lib/types + lib/state
a8a08a4  test(profile): RTL coverage for ThemePicker + EmailAccounts
e07e0f2  docs(handoff): backend session hand-off for new chat — round 7+
```

**Net effect:** `src/components/CareerBuddy.tsx` shrank from 3,097 to
~2,300 lines. 12 lib modules created. 244 frontend tests, including
RTL coverage for all three UI-session-owned profile components.

## Current state — what's available to import

```
src/lib/
├── tracks.ts              TRACKS + Track type + experienceMin/Max
├── cv-storage.ts          STORAGE_KEY + CareerBuddyState + Profile shape
├── job-fit.ts             tokenize, fitScore, fitWhy, intersect, ...
├── job-filters.ts         applyFilters, sortJobs, Filters type, presets
├── profile-store.ts       /profile UI ↔ career-buddy-state bridge
├── format.ts              statusBadge, fitColor, formatSalary, relativeDays
├── jobs-helpers.ts        cleanSnippet, profileCompleteness, signature, ...
├── filter-presets.ts      FilterPreset persistence
├── match-cache.ts         MatchResult/Entry/Cache + quota state
├── types.ts               Profile, State, Application, VcJob, ScoredJob, ...
├── state.ts               emptyState, loadState, migrateProfile
└── cinema-theme.ts        (UI session owns) sage|onyx|slate|coral palette + photo
```

```
src/test/                  vitest setup (jsdom + per-test localStorage stub)
tests/e2e/                 playwright (chromium, sanity placeholder)
docs/iter-3-bundle-baseline.txt   pre-extraction byte capture
data/migrations/0008_classify_runs.sql        quota counter
data/migrations/0009_jobs_classified_at.sql   per-job provenance
data/migrations/0010_user_email_accounts.sql  Phase 1.5 schema (live)
data/migrations/0011_user_tracks.sql           Phase 4 theme schema (live)
```

## Hard rules (DO NOT VIOLATE)

- **No Anthropic API auto-pay.** Claude calls only via local CLI shim
  (Max-20x sub OAuth) at `scripts/claude_cli_shim.py`.
- **No Gemini paid auto-fallback.** 429 surfaces cleanly to UI.
- **No git push without explicit user "ja"** unless the durable
  `Bash(git push:*)` permission rule is in `.claude/settings.local.json`
  (it currently is — verify on first push).
- **No destructive bulk SQL** without scoped where-clauses.
- **No shadcn semantic token override.** No `purple-*` / `#7c3aed`.
- **Pull `--rebase` before push** to surface UI session changes.
- **Subject lines must accurately describe the diff.** Don't bundle
  another session's WIP under a misleading subject.

## Tasks owned by you (backend session) — REMAINING WORK

### Highest-priority (UI session waits on these — ship FIRST)

These six tasks deliver the "Real Supabase persistence for CV-analyzed
profile + first-class skills extraction" user ask. UI session is
blocked on tasks 7–9 until you finish 1–6. Per-task push so A can
pull mid-flight.

1. **Migration `data/migrations/0012_user_profile.sql`** — schema for
   the canonical Supabase profile row. Columns:
   - `id uuid PK DEFAULT gen_random_uuid()`
   - `user_id uuid NULL` (mandatory once auth lands; same convention
     as 0010 / 0011)
   - `name text`, `headline text`, `summary text`
   - `skills jsonb NOT NULL DEFAULT '[]'::jsonb` — first-class array
     of `{ name: string, level?: string, years?: number,
     evidence?: string }` objects (queryable via JSONB containment)
   - `work_history jsonb NOT NULL DEFAULT '[]'::jsonb` (mirror
     `Position[]` shape from `src/lib/types.ts`)
   - `education jsonb NOT NULL DEFAULT '[]'::jsonb` (mirror
     `Education[]`)
   - `target_role text`, `target_geo text`
   - `target_role_categories text[] NOT NULL DEFAULT '{}'`
   - `location_preferences text[] NOT NULL DEFAULT '{}'`
   - `cv_filename text`, `cv_summary text`, `cv_fit_score numeric`
   - `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`
   - `UNIQUE INDEX (COALESCE(user_id::text, ''))` — one row per user
   - `CREATE INDEX user_profile_skills_gin_idx ON user_profile USING
     GIN (skills)` for skill-search queries

2. **Mirror `supabase/migrations/<utc-ts>_user_profile.sql`** — same
   SQL, supabase-CLI-compatible filename. Apply via `cd backend &&
   uv run python -m career_buddy_scraper.cli.migrate`.

3. **`supabase/functions/analyze-cv/index.ts`** — extend Gemini prompt
   to extract `skills` first-class:
   - Add to structured response schema: `skills: array<{ name: string,
     level?: enum["beginner","intermediate","advanced","expert"],
     years?: number, evidence?: string }>`
   - Update prompt with explicit "extract concrete skills with
     inferred level + years from work history" instruction
   - Server-side validation: drop entries missing `name`, clamp
     `years` to `[0, 50]`
   - Add to return type so callers see the new field

4. **Regen `src/integrations/supabase/types.ts`** — pick the same
   tooling as previous regens (commit history shows). Likely
   `npx supabase gen types typescript --project-id <id> > ...` or
   `--linked`. Verify the new `user_profile` table types appear.

5. **Extend `src/lib/cv-storage.ts`** — add `skills?:
   Array<SkillEntry>` to `CvAnalysisResponse` + `Profile`. Update
   `mergeAnalysisIntoState` merge rules: analysis non-empty array
   wins, else prior. Add `SkillEntry` type. Update existing tests +
   add new ones for the skills field.

6. **Extend `src/lib/profile-store.ts`** with Supabase dual-write:
   - New helper `setProfileFromAnalysis(analysis,
     filename): Promise<void>` — calls existing
     `mergeAnalysisIntoState` + `saveCareerBuddyState` (localStorage
     canonical) THEN best-effort upserts the same shape into
     `user_profile` table (swallow network errors via try/catch so
     offline keeps working).
   - On store init, fetch `user_profile` row if available, merge
     into local state (Supabase wins for non-empty fields if
     localStorage version is stale per `updated_at` comparison).
   - Add tests with mocked Supabase client (use the same
     `vi.mock("@/integrations/supabase/client", ...)` pattern as
     `CvUploadInline.test.tsx`).

After 1–6 land + push, write a sync update for UI session (see "Sync
trigger" below). They'll wire 7–9.

### Lower-priority (no UI dependency)

7. **Pre-existing `CareerBuddy.tsx:501` Supabase upsert TS error**
   (surgical fix, ~10 lines):
   - Error: `Argument of type 'Record<string, unknown>' is not
     assignable to parameter of type RejectExcessProperties<...>`
     when `applications.upsert(rows)` is called.
   - Root: `applicationToRow()` in `src/lib/jobs-helpers.ts` returns
     `Record<string, unknown>`; Supabase typed client wants the
     named row shape.
   - Fix: import the `Database` row type from
     `src/integrations/supabase/types.ts`, narrow the return type to
     `Database["public"]["Tables"]["applications"]["Insert"]`.
   - User listed this as remaining → safe to fix this round.

8. **`tests/e2e/lazy-chunks.spec.ts`** — Playwright bundle byte-budget
   assertion (Iter-3 Phase 4 prep):
   - Open `/`, capture every `*.js` URL via `page.on("response")`
   - Open `/profile` then `/cv`, capture per-route chunks
   - Assert: profile-/cv- chunks ABSENT from `/` initial load
   - Assert: each route loads ≥1 unique chunk
   - Assert: initial `/` entry chunk size ≤ baseline × 1.05 (read
     `docs/iter-3-bundle-baseline.txt`)
   - Wire `webServer` in `playwright.config.ts` to `bun run preview`
     (currently deferred; un-defer for this test).
   - Gates Phase 4 monolith-deletion: any future bundle regression
     fails CI.

9. **`scripts/smoke-routes.sh`** — hard-reload curl smoke for
   Cloudflare Workers SPA fallback:
   - `curl -L http://localhost:8788/{,profile,cv,buddy,jobs}` returns
     200
   - Run after `bun run preview` is up
   - Header comment notes it tests the Worker SPA fallback, not Vite

### Deferred (waits on external signal)

10. **Migration `0013_user_context_notes.sql`** — only when UI session
    starts Phase 5 (Auto-context summarise back to Supabase).
    Schema sketch in `CLAUDE_COORDINATION.md`. Don't ship until UI
    pings.

11. **Visa / level Gemini batch enrichment** — only when Gemini Free
    Tier daily quota refreshes (~midnight Pacific). Adapt existing
    `cli.classify_tier2_claude` pattern.

12. **Phase 1.6 backend OAuth** for `user_email_accounts` (0010 schema):
    - New Supabase edge functions `email-oauth-start` +
      `email-oauth-callback`
    - KMS / pgcrypto wrap policy for `oauth_refresh_token` (column is
      `bytea` — never plaintext)
    - **Open question for user:** Gmail-only first or Gmail + Outlook
      day-1? Don't ship without an answer.

13. **Multi-user auth + RLS** — single-user assumption everywhere.
    Big phase, not blocking. Plan when user wants it.

## What's NOT yours (UI session territory — DO NOT touch)

- `src/routes/*` (any file) — UI owns route composition + cinema chrome
- `src/components/cinema/*` — design system primitives
- `src/components/profile/*.tsx` (component code) — UI owns ThemePicker,
  EmailAccounts, CvUploadInline. **You CAN write `*.test.tsx` files**
  for these.
- Future component extractions: 8 child components still in the
  monolith (JobCard, FilterBar, DraftModal, ApplicationsTracker,
  ApplicationRow, AddAppModal, ProfileCard, EditProfileModal,
  InsightsPanel) — UI owns when extraction starts
- `public/sw.js` — service worker, UI owns
- `docs/design/*` — cinema spec
- Voice input (Web Speech API) — Phase 1 of cinema-personalisation
- Floating Buddy widget — Phase 2 of cinema-personalisation
- Skills probe UI (Section 03 wire on `/profile`) — Phase 6 + the new
  ask task 8
- Onyx / Slate / Coral palette tweaks — UI bug bash territory

## Working order for the new session

1. **Read CLAUDE_COORDINATION.md.** Boundary contract. The "NEW ASK"
   section locks the split for the CV-profile-Supabase work.
2. **`git pull --rebase origin main`** before doing anything.
3. **Run the verification block below** to confirm rig is intact.
4. **Start with the new-ask tasks 1–6** — they're the user's blocking
   ask, A is waiting.
5. **Push commit-by-commit** so A can pull mid-flight.
6. **Update CLAUDE_COORDINATION.md** at the end of each round (move
   completed items from `[ ]` to `[x]`, add new soft-skips, refresh
   the "Last sync" line).
7. **Sync trigger:** after tasks 1–6 ship (or if you blocker), write
   a sync update for the UI session. The user copy-pastes it across.
8. **Continue with tasks 7–9** if you have bandwidth + A hasn't
   pinged yet.

## Verification block (paste into the new session)

```bash
cd /Users/troelsenigk/fa-track
git pull --rebase origin main
git status                              # clean expected
git log --oneline -10                   # head ≥ e07e0f2
curl -m 3 -s http://127.0.0.1:5051/health    # claude-shim health (optional)
curl -sI https://career-buddy.enigkt1.workers.dev/ | head -3  # 200
bun run test | tail -3                  # 244 passed
bun run build:dev | tail -3             # green
bunx tsc --noEmit 2>&1 | grep -c "CareerBuddy.tsx"   # 1 (pre-existing)
cd backend && uv run pytest -q | tail -2   # 258 passed
```

## How the user wants you to work

- **Caveman mode** is the default. Drop articles/filler/hedging.
  Code/commits/security: write normal.
- **Auto mode is on.** Don't enter plan mode unless explicitly asked.
  Make reasonable assumptions, proceed on low-risk work.
- **Don't take destructive actions** — anything that deletes data,
  modifies shared/production systems, or sends external messages
  needs explicit user confirmation. Schema migrations apply via the
  migrate CLI which is safe (`CREATE TABLE IF NOT EXISTS` etc.).
- **Plan reviews with Codex** until 10/10 BEFORE execute, for
  high-stakes decisions only (architecture, schema migrations,
  breaking changes). Lift-only refactors don't need Codex.
- **Code review of diff** after each phase — invoke
  `codex:codex-rescue` with strict scoring on big surfaces.
- **Push permission:** durable rule `Bash(git push:*)` is in
  `.claude/settings.local.json`. Verify on first push attempt; if
  classifier blocks, ask user.

## Memory pointers

- `~/.claude/projects/-Users-troelsenigk-fa-track/memory/MEMORY.md`
  is auto-loaded into every conversation. Add an entry for any
  non-obvious decision or workflow that future you will need.
- `WORKPLAN-*.md` (gitignored) — one file per session topic. The
  cinema-personalisation workplan is UI session's; the iter-3 split
  deferred plan is yours (if it exists locally).

## Sync trigger — when to ping back to A

Open a sync round when:
- All 6 new-ask tasks shipped (highest priority — A unblocked)
- 2+ tasks shipped + 24h elapsed (round-cadence)
- Schema change that affects A (e.g. `user_profile` row shape lock)
- Hit a blocker that needs A's greenlight

Sync format: brief commit list + greenlights needed. The user
copy-pastes the prompt across; A responds; you continue.

## Out of scope for this hand-off

- 8-component monolith extraction (UI owns the components)
- /jobs route turning into standalone — UI Phase 3
- Cinema personalisation phases 1, 2, 6 — UI session
- Frontend route changes — UI session
- Style / palette tweaks — UI session
- The `/profile` Section 03 Skills wire — UI task 8 of the new ask

If the user explicitly asks for any of the above, push back politely
and remind them you're the backend session; suggest they open it as
a UI session sync round instead.
