# Claude session coordination — Career-Buddy

> Two Claude Code sessions are working on this repo in parallel today.
> This file is the source of truth for who-owns-what so we don't drift.
> **Re-read at the start of every coordination round.**

## Active sessions (2026-05-10 evening)

| Session | Owner area | Status |
|---|---|---|
| **A — UI session** (this file's primary author) | `src/routes/*` (visual), `src/components/cinema/*`, `src/components/profile/*`, `public/sw.js`, design docs, photography | Phase 0.5 shipped (commit `c1f47ee`). Working on bug-fix follow-up + email-integration spec. |
| **B — Backend + tooling session** | `backend/career_buddy_scraper/*`, `data/migrations/*`, vitest + playwright config, `src/lib/*` extraction (Phase 1 of iter-3 split) | Backend classifier 100% (commit `d82770b` ancestry). Test infra shipped. Next: `lib/*` extraction with vitest tests on `tokenize`, `fitScore`, `applyFilters`. |

## Boundary — who touches what

| Area | A | B | Notes |
|---|---|---|---|
| `src/components/CareerBuddy.tsx` | edits OK while extraction not started | will lift logic into `src/lib/*` after A signals stable | A must pause edits when B starts extraction commit-by-commit |
| `src/lib/{tracks,job-fit,job-filters,cv-storage}.ts` | read-only | OWNS | B creates these, A imports |
| `src/components/{profile,applications,roles,insights}/*` | NEW components OK in `profile/` only | future ownership when extraction arrives | currently only `profile/CvUploadInline.tsx` exists |
| `src/routes/*` | OWNS | read-only | B doesn't ship route files |
| `src/components/cinema/*` | OWNS | read-only | design system primitives |
| `public/sw.js` | OWNS | read-only | service worker version-bump on cache-busting deploys |
| `backend/`, `data/migrations/` | read-only | OWNS | scraper + classifier + Supabase schema |
| `supabase/functions/*` | edits with announce | edits with announce | both can touch — coordinate via this file before |
| `vitest.config.ts`, `playwright.config.ts`, `src/test/*`, `tests/*` | read-only | OWNS | B owns the test rig |
| `docs/design/*` | OWNS | read-only | cinema design system spec |
| `WORKPLAN-*.md` (gitignored) | OWNS A's plan | OWNS B's plan | one file per session, prefixed by topic |
| `MEMORY.md` + `~/.claude/projects/.../memory/*` | OWNS A's entries | OWNS B's entries | append-only across sessions |

## Commit hygiene

- Subject line MUST accurately describe the diff. Bundling unrelated
  WIP under a misleading subject (as happened with `c1f47ee` → "vitest
  + playwright tooling" while the diff also included A's UI WIP) makes
  history hard to read. If you find your `git add` swept up another
  session's files, split the commit before pushing.
- `git pull --rebase origin main` before any push to surface conflicts.
- Push commit-by-commit when working on multi-step extraction so the
  other session can pull mid-flight.

## Open items right now

### Owned by A (UI session)
- [x] Phase 0.5 IA cleanup + Profile depth + /jobs route + cinema chrome
- [x] CV upload service-worker cache fix (sw v3 + network-first for HTML)
- [x] PromoBar /jobs link, /jobs fetch raised 500 → 10000
- [x] Phase 4 step 1: theme-swap architecture + Onyx prototype
      (`fafc7b4`)
- [x] Phase 4 step 2: Slate + Coral palettes + per-theme photography
      library + `usePhoto()` hook (`bbbcb8c`)
- [x] Hero readability fix on light themes (`797d227`)
- [ ] **Phase 4 step 3: theme picker UI on Profile** (drop the
      `?theme=` URL-param requirement; add a chip-set in Profile that
      writes to localStorage `career-buddy-theme-v1` + sets
      `<html data-theme>`. Highest user-facing value left in Phase 4.)
- [ ] Email integration UI Phase 1.5 (Gmail OAuth + multi-account
      picker; B's `0010_user_email_accounts.sql` is live, so unblocked)
- [ ] Wire `<html data-theme>` to `user.track_primary` after B ships a
      `user_tracks` migration (different from `user_email_accounts`)

### Owned by B (backend + tooling session)
- [x] Phase 1 lib extraction: `tracks`, `cv-storage`, `job-fit`,
      `job-filters`, `profile-store` — all 5 modules + 112 vitest
      tests (`4bf0c23` … `c0a2214`)
- [x] Migration `0010_user_email_accounts.sql` shipped + applied
      to Supabase (`e5c8d88`)
- [ ] **lib shrink continued:** `formatSalary`, `relativeDays`,
      `fitColor`, `cleanSnippet`, `profileCompleteness`,
      `applicationToRow`, `safeIsoDate`, `profileSignature` —
      B identified these as the next pure-helper extraction batch
- [ ] **Vitest tests for `CvUploadInline.tsx` with RTL** — A owns the
      component, B writes the tests (approved by A this round)
- [ ] Migration `0011_jobs_search_index.sql` with
      `CREATE INDEX CONCURRENTLY` (Phase 3 dep — when A does
      server-side jobs pagination)
- [ ] **NEW: migration for `user_tracks`** so A can wire
      `<html data-theme>` to `user.track_primary` and finish Phase 4

### Open questions for the user (don't act until answered)
- Email integration: Gmail-only first (covers 80%) or Gmail + Outlook day-1?
- Photo gallery: licensed Unsplash+ tier, AI-generated, or curated public-domain?

## Known soft-skip items (intentional, not blockers)

- `/jobs` mounts `<CareerBuddy rolesOnly />` — placeholder until B's
  Phase 2 extraction ships `<RoleGrid />` standalone.
- Pre-existing `tsc --strict` failure at `CareerBuddy.tsx:839`
  (Supabase `applications.upsert` type mismatch — line moved from
  :1170 after lib extraction shrunk the file). Pre-dates both
  sessions, neither owns the fix today.

## Resolved soft-skips (no longer applicable)

- ~~Profile `years` + `tracks` write to their own localStorage keys
  only~~ → resolved by B in `c0a2214`. `lib/profile-store.ts` now
  dual-writes legacy keys + `career-buddy-state.profile`
  (`target_role_categories`, `years_min`, `years_max`). Profile-side
  selections now influence role-fit grading on Overview.
- ~~Hardcoded `TRACKS` in `src/routes/profile.tsx`~~ → resolved by B
  in `4bf0c23`, now in `src/lib/tracks.ts` with Track type +
  experience-window helpers.

## Last sync

- 2026-05-10 evening (round 4) — B finished Phase 1 lib extraction
  (5 modules + 112 tests + migration 0010). A finished Phase 4 step 1
  (theme-swap arch + Onyx) + step 2 (Slate + Coral + per-theme
  photography). B asks A: green-light to (1) keep shrinking lib with
  formatSalary etc., (2) write RTL tests for CvUploadInline. A says
  yes to both. A commits to Phase 4 step 3 (Profile theme picker UI)
  next, then Email integration UI Phase 1.5.
