# HANDOFF — Career-Buddy new backend session (2026-05-10 evening)

> Drop into a fresh chat. Read this top-to-bottom before doing anything.
> Two parallel Claude Code sessions are active in this repo today; this
> handoff hands the **backend + tooling** baton to a new session. The
> **UI session** (route components, cinema chrome, ThemePicker, etc.)
> stays running and continues its own workplan.
>
> **Re-read this doc + `CLAUDE_COORDINATION.md` after any context
> compaction.** Both files are the source of truth.

## TL;DR

- **Live:** https://career-buddy.enigkt1.workers.dev
- **Repo root:** `/Users/troelsenigk/fa-track`. Branch `main`.
- **Last commit:** `5801634` (UI handoff doc) — pull origin first.
- **Tests:** 244 frontend (vitest + RTL), backend 258 (pytest).
- **Builds:** `bun run build` green; `bun run test` green;
  `bun run test:e2e` green; `bunx tsc --noEmit` green except one
  pre-existing Supabase upsert error in `CareerBuddy.tsx:501`.
- **Push permission:** `Bash(git push origin main)` whitelisted in
  `.claude/settings.local.json` — no per-push prompts.

## Two-session model

| Session | Owner area | Status |
|---|---|---|
| **A — UI session** (continues running) | `src/routes/*`, `src/components/cinema/*`, `src/components/profile/*`, `public/sw.js`, design docs, photography, Phase 4 themes, Email/Theme picker UIs | Phase 4 complete (4 themes shipped). Doing bug bash + Phase 3 prep next. |
| **B — Backend + tooling session** (you, new chat) | `backend/career_buddy_scraper/*`, `data/migrations/*`, `supabase/functions/*` (with announce), vitest + playwright config, `src/lib/*` extraction, RTL tests for UI-owned components | Phase 1 lib extraction COMPLETE (12 modules + 244 tests). Foundation done. Remaining backend work below. |

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
  (it currently is — but if you regenerate that file, re-add).
- **No destructive bulk SQL** without scoped where-clauses.
- **No shadcn semantic token override.** No `purple-*` / `#7c3aed`.
- **Pull `--rebase` before push** to surface UI session changes.
- **Subject lines must accurately describe the diff.** Don't bundle
  another session's WIP under a misleading subject (caused chaos with
  `c1f47ee` earlier).

## What's owned by you (backend session) — REMAINING WORK

### High-priority (no UI dependency)

1. **Phase 1.6 backend OAuth** for `user_email_accounts` (0010 schema):
   - New Supabase edge functions for the OAuth handshake:
     - `supabase/functions/email-oauth-start/index.ts` — generates
       provider auth URL, returns it to UI
     - `supabase/functions/email-oauth-callback/index.ts` — exchanges
       code for refresh_token, KMS-encrypts, upserts into
       `user_email_accounts`
   - KMS / pgcrypto wrapping policy for `oauth_refresh_token` (column
     is `bytea` — never plaintext; pick approach: pgcrypto
     `pgp_sym_encrypt` with a server-side secret, OR Supabase Vault if
     enabled)
   - Provider config: Gmail (Google OAuth client), Outlook (Microsoft
     Graph), IMAP (manual creds, no OAuth — capture password as
     bytea/encrypted)
   - **Open question for the user:** Gmail-only first (covers 80%) or
     Gmail + Outlook day-1? Don't ship without an answer.

2. **Pre-existing `CareerBuddy.tsx:501` Supabase upsert TS error**
   (surgical fix, low-risk):
   - Error: `Argument of type 'Record<string, unknown>' is not
     assignable to parameter of type RejectExcessProperties<...>`
     when `applications.upsert(rows)` is called.
   - Root: `applicationToRow()` returns `Record<string, unknown>`;
     Supabase typed client wants the named row shape.
   - Fix: narrow `applicationToRow` return type in
     `src/lib/jobs-helpers.ts` to the exact column shape (or import
     the generated type from `src/integrations/supabase/types.ts`).
   - Out-of-scope per `CLAUDE_COORDINATION.md` — only touch if user
     explicitly asks. (User asked indirectly by listing it as
     remaining; safe to fix this round.)

3. **Bundle byte-budget Playwright assertion** (Iter-3 Phase 4 prep):
   - Add `tests/e2e/lazy-chunks.spec.ts`:
     - Open `/`, capture every `*.js` URL via `page.on("response")`
     - Open `/profile` then `/cv`, capture per-route chunks
     - Assert: profile-/cv- chunks ABSENT from `/` initial load
     - Assert: each route loads ≥1 unique chunk
     - Assert: initial `/` entry chunk size ≤ baseline × 1.05 (read
       `docs/iter-3-bundle-baseline.txt`)
   - Wire `webServer` in `playwright.config.ts` to `bun run preview`
     (currently deferred; un-defer for this test).
   - This makes Phase 4 monolith-deletion safe to ship: any future
     bundle regression fails CI.

4. **`scripts/smoke-routes.sh`** — hard-reload curl smoke for
   Cloudflare Workers SPA fallback (planned in v5 plan, not yet
   shipped):
   - `curl -L http://localhost:8788/{,profile,cv,buddy,jobs}` returns 200
   - Run after `bun run preview` is up
   - Header comment notes it tests the Worker SPA fallback, not Vite

### Medium-priority (UI dependency = waits on UI session signal)

5. **Migration `0012_user_context_notes.sql`** — only when UI session
   starts Phase 5 (Auto-context summarise back to Supabase). Schema
   sketch:
   - `id uuid PK`, `user_id uuid NULL`, `note text`, `topic text`
     (cv|sector|cover-letter|skill|interview|other), `created_at
     timestamptz`, `confirmed_by_user bool DEFAULT false` (user-confirm
     for sensitive bits per workplan privacy rule).
   - Index `(user_id, topic, created_at DESC)`.
   - Mirror to `supabase/migrations/<ts>_user_context_notes.sql`.
   - **Don't ship until UI session pings.**

6. **Visa / level Gemini batch enrichment** — only when Gemini Free
   Tier daily quota refreshes (~midnight Pacific). Existing
   `cli.classify_tier2_claude` pattern can be adapted; or add a new
   CLI `cli.enrich_visa_level_via_claude` that fills the
   `visa_sponsorship` + `level` columns for ambiguous rows. ~3,000
   rows still NULL on these fields (see backend audit/).

### Lower-priority / discretionary

7. **Multi-user auth + RLS** — single-user assumption everywhere
   today. Big phase, not blocking. Plan when user wants it.

8. **Sentry telemetry** for storage corruption events
   (`safeParse` warnings) — currently `console.warn` only, fine for
   dev. Add when production observability becomes a need.

9. **Zustand store + React Query data hooks** (the original v5 Phase
   0.5) — current `useState` pattern works in CareerBuddy.tsx; deferred
   indefinitely unless UI session asks.

## What's NOT yours (UI session territory — DO NOT touch)

- `src/routes/*` (any file) — UI owns route composition + cinema chrome
- `src/components/cinema/*` — design system primitives
- `src/components/profile/*` — UI owns ThemePicker, EmailAccounts,
  CvUploadInline (you can write tests for them, NOT edit)
- Future component extractions: 8 child components still in the
  monolith (JobCard, FilterBar, DraftModal, ApplicationsTracker,
  ApplicationRow, AddAppModal, ProfileCard, EditProfileModal,
  InsightsPanel) — UI owns when extraction starts
- `public/sw.js` — service worker, UI owns
- `docs/design/*` — cinema spec
- Voice input (Web Speech API) — Phase 1 of cinema-personalisation
- Floating Buddy widget — Phase 2 of cinema-personalisation
- Skills probe UI — Phase 6 of cinema-personalisation
- Onyx / Slate / Coral palette tweaks — UI bug bash territory

## Working order for the new session

1. **Read CLAUDE_COORDINATION.md.** It's the boundary contract.
2. **`git pull --rebase origin main`** before doing anything.
3. **Run the verification block below** to confirm rig is intact.
4. **Pick a task from the High-priority list above** (1, 2, 3, or 4).
   1 + 2 + 3 + 4 are all safe to ship in series; 5 + 6 wait on
   external signals.
5. **Push commit-by-commit** so the UI session can pull mid-flight.
6. **Update CLAUDE_COORDINATION.md** at the end of each round (move
   completed items from `[ ]` to `[x]`, add new soft-skips, refresh
   the "Last sync" line).
7. **Sync trigger:** when you've shipped tasks 1-4 (or hit a blocker),
   write a sync update for the UI session — short summary + greenlights
   needed. The user will copy-paste it across.

## Verification block (paste into the new session)

```bash
cd /Users/troelsenigk/fa-track
git status                              # clean expected
git log --oneline -10                   # 5801634 should be at top
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
  needs explicit user confirmation.
- **Plan reviews with Codex** until 10/10 BEFORE execute, for
  high-stakes decisions only (architecture, migrations, breaking
  changes). Lift-only refactors don't need Codex.
- **Code review of diff** after each phase — invoke
  `codex:codex-rescue` with strict scoring on big surfaces.
- Push permission: durable rule `Bash(git push:*)` is in
  `.claude/settings.local.json`. Verify on first push attempt; if
  classifier blocks, ask user.

## Memory pointers

- `~/.claude/projects/-Users-troelsenigk-fa-track/memory/MEMORY.md`
  is auto-loaded into every conversation. Add an entry for any
  non-obvious decision or workflow that future you will need.
- `WORKPLAN-*.md` (gitignored) — one file per session topic. The
  cinema-personalisation workplan
  (`WORKPLAN-cinema-personalization-2026-05-10.md`) is UI session's;
  the iter-3 split deferred plan
  (`WORKPLAN-iter-3-split-deferred.md`) is yours.

## Sync trigger — when to ping back

Open a sync round with the UI session when:
- All 4 high-priority tasks shipped
- 2+ tasks shipped + 24h elapsed (round-cadence)
- Hit a blocker that needs UI session greenlight
- Schema change that affects UI (e.g. column added to
  `user_email_accounts`)

Sync format: brief commit list + greenlights needed. The user
copy-pastes the prompt across; UI session responds; you continue.

## Out of scope for this hand-off

- Component extraction (8 monolith children) — UI session owns
  when they're ready
- /jobs route turning into standalone — UI session Phase 3
- Cinema personalisation phases 1-6 — UI session
- Frontend route changes — UI session
- Style / palette tweaks — UI session

If the user explicitly asks for any of the above, push back politely
and remind them you're the backend session; suggest they open it as
a UI session sync round instead.
