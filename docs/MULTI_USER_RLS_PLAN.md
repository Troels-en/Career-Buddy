# WORKPLAN — Multi-user auth + RLS

> Goal: lift Career-Buddy from single-user-localStorage to a real
> Supabase-Auth-backed multi-user app with RLS enforcement.
>
> Constraint: don't break the existing single-user experience for
> the dev user (Troels). All current localStorage data must survive
> the cutover.

## Scope

**In scope:**
- Supabase Auth provider config (email magic-link + Google OAuth)
- Migration 0014: drop COALESCE-based unique indexes; add real
  `user_id NOT NULL` + FK to `auth.users(id)` on every user-scoped
  table; add real unique indexes per-user.
- RLS policies on: `user_profile`, `user_tracks`,
  `user_email_accounts`, `user_context_notes`, `applications`.
- Library wiring: every `supabase.from(...)` user-scoped call
  passes through `auth.uid()` via session-token instead of
  `is("user_id", null)`.
- Frontend: login route (`/login`) + session boot + logout pill.
- LocalStorage migration: on first signed-in load, dual-write
  legacy localStorage state to the new user's Supabase rows + mark
  migration complete so we don't double-migrate.
- Edge functions: validate JWT, derive user_id, scope writes.

**Out of scope:**
- Multi-tenant (orgs/teams) — different shape, not asked.
- Social-graph features.
- Existing-data preservation for users OTHER than the dev user
  (we have one user; nothing to preserve from anyone else).
- Job catalog (`jobs`, `vcs`) — stays public-readable.
- Rate-limiting, password reset flow custom UI (Supabase handles).

## Architecture decisions

### Auth providers — Email magic-link + Google OAuth
- Email magic-link: lowest-friction, no password storage on our
  side. Default sign-up path.
- Google OAuth: optional, faster for users with Google accounts.
  Same `auth.users` row; Supabase merges by email.
- Skip GitHub / Apple / Facebook for v1 — add later if asked.

### user_id NOT NULL — hard cutover, no soft phase
- Once auth is live the single-user `user_id IS NULL` pattern is
  no longer valid. We migrate the existing NULL rows to the dev
  user's `auth.uid()` in the same migration script.
- Pre-migration: dev user signs up first → captures their
  `auth.users.id`. Then we run 0014 which (a) backfills existing
  NULL rows to that UUID, (b) sets NOT NULL, (c) adds FK.

### RLS pattern — "own only"
- One policy per CRUD verb (`SELECT / INSERT / UPDATE / DELETE`)
  per user-scoped table.
- All use `auth.uid() = user_id` predicate.
- `applications.user_id` already exists + has FK; just enable RLS
  + add policies.
- `events` (linked via `application_id`): RLS via JOIN; SELECT
  policy reads through to `applications.user_id`.

### Edge functions — JWT validation, scoped writes

**Key strategy (explicit so we don't accidentally bypass RLS):**

| Caller side | Key used | When |
|---|---|---|
| Browser → `supabase.functions.invoke()` | anon key + user JWT (auto-attached) | All user-scoped writes; RLS enforces |
| Edge function reading shared catalog (jobs, vcs) | service-role key | Cross-user reads only; never written to a client response without re-filtering |
| Edge function writing to a user-scoped table on behalf of the caller | derived `user_id` from the JWT (NOT service-role) | Preserves RLS audit trail |

**Service-role key NEVER ships to the browser** (it's in Supabase
env vars under the Functions runtime only). Anon key + JWT is what
the frontend uses for all writes — RLS is the security boundary,
not server-side key checks.

**Implementation contract per edge function:**
```ts
// shared helper, supabase/functions/_shared/auth.ts
async function getAuthUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  // getUser() round-trips the token to Supabase Auth and returns
  // the user row OR null if (a) JWT expired, (b) JWT malformed,
  // or (c) the underlying auth.users row was deleted since the
  // token issued. Treat all three as 401 — Supabase Auth already
  // performs the auth.users existence check inside getUser, so we
  // don't need an extra SELECT on auth.users to defend against
  // deleted-user JWTs.
  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user || !data.user.id) return null;
  return data.user.id;
}

// Usage:
const uid = await getAuthUserId(req);
if (!uid) return jsonResponse({ error: "unauthorized" }, 401);
```

**`supabase.functions.invoke()` auth propagation failure modes:**
- If the user session has expired between page load and call →
  the JWT is stale; getUser() returns null; edge function returns
  401; client's onError surfaces "Please sign in again." UI.
- If the user is anonymous (no session) → no Authorization
  header; edge function returns 401; UI redirects to /login.
- Public endpoints (e.g. a future `chat` anonymous-demo mode)
  short-circuit BEFORE the auth check.
- The Supabase JS client refreshes JWTs automatically when
  `autoRefreshToken: true` (already set in
  `src/integrations/supabase/client.ts`); only stale-on-the-wire
  cases ever hit 401 in practice.

### LocalStorage migration — best-effort, per-data-class on first signed-in load

Gate **per-data-class** independently — a single "user_profile is
empty" check would skip applications / tracks / dismissals
migration whenever a profile row exists (common: dev user already
has a profile from pre-cutover dual-write).

Run these in parallel inside `migrateLocalStorageToSupabase()`:

| Data class | Per-class gate | Upsert shape | onConflict |
|---|---|---|---|
| `user_profile` | localStorage profile non-empty AND remote row missing OR `updated_at` older than local | full Profile row, `user_id = auth.uid()` | `user_id` |
| `user_tracks` | localStorage track + years bucket present AND remote row missing | track_primary + track_secondary | `user_id` |
| `user_email_accounts` | always run (no localStorage source currently) | n/a — UI-driven later | — |
| `applications` | localStorage applications array has entries | each row via `applications.upsert(rows, { onConflict: "user_id,client_id" })` | `user_id,client_id` |
| `job_dismissals` | localStorage `dismissed_urls` non-empty | one row per URL via `job_dismissals.upsert(rows, { onConflict: "user_id,url" })` | `user_id,url` |
| `user_context_notes` | no migration source — fresh history starts post-cutover | — | — |

Per-class idempotency flag: `career-buddy-migrated-${uid}-${class}`
(e.g. `career-buddy-migrated-abc123-profile`). Set after a
class's migration succeeds (or after the upsert returns OK). A
class that fails (network down) stays unflagged so the next page
load retries that class only — surgical.
- Idempotency flags are **per-data-class + per-user**:
  `career-buddy-migrated-${uid}-${class}` (one key per class —
  see the LocalStorage migration table below). No global
  `career-buddy-migrated-${uid}` flag — global gating was the
  bug codex flagged in v3.
- Multi-tab race protection — layered:
  1. **Primary:** `BroadcastChannel("cb-migrate")` — first tab
     claims, broadcasts "started"; other tabs skip.
  2. **Fallback (Safari/Firefox private-browsing, where
     BroadcastChannel may be undefined or no-op):** localStorage
     mutex via the `career-buddy-migrate-lock-${uid}` key with a
     timestamp value. Acquire = compare-and-set (write-then-read);
     if the read returns our own timestamp we own the lock. Other
     tabs poll the key once at boot; if present + < 30s old, skip.
  3. **Auto-expire 30s** in both modes so a crashed initiator
     tab doesn't permanently block migration.
  4. **Last-write-wins** is acceptable for v1 even if both
     primary AND fallback fail — the Supabase upserts are
     idempotent (UNIQUE per user_id on every table).

### UI changes (A territory; B documents the contract)
- New route `/login` — magic-link + Google buttons.
- `<RootShell />` gates: when no session → redirect to /login
  except for `/login` itself.
- Logout pill in cinema chrome top-right.
- Theme picker session-aware: anonymous mode still localStorage,
  signed-in syncs via existing 0011 wiring (already works).

## Migration plan — concrete files

### 0014_auth_user_id_fk.sql

```sql
-- 0014_auth_user_id_fk.sql
-- Multi-user cutover: every user-scoped table gets real FK to
-- auth.users + RLS enabled. Existing NULL rows are reassigned to
-- the bootstrap dev user UUID (passed in via psql variable so the
-- migration is parameterised; we don't hardcode the UUID in git).

-- Param: :bootstrap_user_id (uuid)
\if :{?bootstrap_user_id}
\else
  \echo 'ERROR: pass -v bootstrap_user_id=<uuid> on psql command line'
  \q
\endif

BEGIN;

-- Step 1: assign existing NULL rows to the bootstrap user across
-- EVERY user-scoped table introduced in 0010 / 0011 / 0012 / 0013.
-- These all started life with `user_id uuid NULL` + a COALESCE-
-- based unique index; backfilling them before adding NOT NULL +
-- FK is mandatory or the ALTER fails.
UPDATE user_email_accounts  SET user_id = :'bootstrap_user_id' WHERE user_id IS NULL;  -- 0010
UPDATE user_tracks          SET user_id = :'bootstrap_user_id' WHERE user_id IS NULL;  -- 0011
UPDATE user_profile         SET user_id = :'bootstrap_user_id' WHERE user_id IS NULL;  -- 0012
UPDATE user_context_notes   SET user_id = :'bootstrap_user_id' WHERE user_id IS NULL;  -- 0013

-- Sanity: bail loudly if any user-scoped row still has NULL user_id
-- after the backfill — means a new table was added without updating
-- this migration.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM user_email_accounts WHERE user_id IS NULL
    UNION ALL SELECT 1 FROM user_tracks WHERE user_id IS NULL
    UNION ALL SELECT 1 FROM user_profile WHERE user_id IS NULL
    UNION ALL SELECT 1 FROM user_context_notes WHERE user_id IS NULL
  ) q;
  IF n > 0 THEN
    RAISE EXCEPTION '% NULL user_id rows remain after backfill — refusing to NOT NULL the columns', n;
  END IF;
END $$;

-- Step 2: drop the COALESCE-based "one row per user" unique indexes
-- (they used the magic '' fallback for single-user phase).
DROP INDEX IF EXISTS user_profile_user_id_idx;
DROP INDEX IF EXISTS user_tracks_user_id_idx;
DROP INDEX IF EXISTS user_email_accounts_user_email_idx;
DROP INDEX IF EXISTS user_email_accounts_one_primary_per_user_idx;

-- Step 3: NOT NULL + FK to auth.users.
ALTER TABLE user_profile
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT user_profile_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_tracks
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT user_tracks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_email_accounts
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT user_email_accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_context_notes
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT user_context_notes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- applications.user_id already has FK to public.users (legacy).
-- Two-step rewrite: drop the legacy FK first, then REWRITE every
-- existing user_id value to the bootstrap auth.users UUID
-- (everything in this single-user phase is the dev user), THEN
-- add the new FK against auth.users. The blanket UPDATE is safe
-- here precisely because we ARE single-user — every row belongs
-- to the bootstrap user. Multi-user dev-data backfill is out of
-- scope (we have no other users yet).
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_user_id_fkey;
UPDATE applications SET user_id = :'bootstrap_user_id';
ALTER TABLE applications
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT applications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the legacy public.users table — pre-Supabase-Auth artefact,
-- no longer referenced after the FK above repoints to auth.users.
--
-- Three-layer dependency check before drop:
--   (a) inbound FKs (pg_constraint)
--   (b) views referencing it (pg_rewrite → pg_depend)
--   (c) functions / procedures referencing it (pg_proc bodies)
--   (d) triggers attached to it (pg_trigger)
-- Any hit → migration aborts with a pointer; the dev runbook
-- documents the manual cleanup (rename / drop the dependent
-- object) before re-running 0014.
DO $$
DECLARE
  bad_fk     int;
  bad_view   int;
  bad_fn     int;
  bad_trig   int;
BEGIN
  SELECT count(*) INTO bad_fk
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.confrelid
    WHERE t.relname = 'users' AND t.relnamespace = 'public'::regnamespace
      AND c.conrelid <> 'public.users'::regclass;

  SELECT count(*) INTO bad_view
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class t ON t.oid = d.refobjid
    WHERE t.relname = 'users' AND t.relnamespace = 'public'::regnamespace
      AND d.refobjsubid > 0;

  SELECT count(*) INTO bad_fn
    FROM pg_proc p
    WHERE p.prosrc LIKE '%public.users%' OR p.prosrc LIKE '%"public"."users"%';

  SELECT count(*) INTO bad_trig
    FROM pg_trigger tg
    JOIN pg_class t ON t.oid = tg.tgrelid
    WHERE t.relname = 'users' AND t.relnamespace = 'public'::regnamespace;

  IF (bad_fk + bad_view + bad_fn + bad_trig) > 0 THEN
    RAISE EXCEPTION
      'public.users has dependents: % FKs, % views, % functions, % triggers — clean these up first',
      bad_fk, bad_view, bad_fn, bad_trig;
  END IF;
END $$;
-- RESTRICT instead of CASCADE: the DO block above already proved
-- zero dependents in four classes (FKs, views, functions, triggers).
-- RESTRICT makes the DROP itself fail loudly if any 5th-class
-- dependency type slipped through (sequence ownership, comments,
-- ACL inheritance) rather than silently collateral-dropping it.
DROP TABLE IF EXISTS public.users RESTRICT;

-- Step 4: real per-user unique indexes (replace COALESCE ones).
CREATE UNIQUE INDEX user_profile_one_per_user
  ON user_profile (user_id);
CREATE UNIQUE INDEX user_tracks_one_per_user
  ON user_tracks (user_id);
CREATE UNIQUE INDEX user_email_accounts_user_email
  ON user_email_accounts (user_id, email);
CREATE UNIQUE INDEX user_email_accounts_one_primary_per_user
  ON user_email_accounts (user_id) WHERE is_primary = true;

-- Step 5: applications.client_id is currently UNIQUE globally
-- (0005_apps_client_id.sql). In single-user that worked; once
-- multiple users sync from independent local stores, two users
-- can both produce `a1731512345`-style client_ids and collide.
-- Repoint the constraint to (user_id, client_id).
--
-- NON-partial: PostgREST / supabase-js `onConflict: "user_id,
-- client_id"` cannot target a partial index. Backfill all
-- applications rows with a synthetic client_id first if any are
-- NULL, then create the full unique index.
UPDATE applications
   SET client_id = 'legacy_' || id::text
 WHERE client_id IS NULL;
ALTER TABLE applications ALTER COLUMN client_id SET NOT NULL;
DROP INDEX IF EXISTS ux_applications_client_id;
CREATE UNIQUE INDEX ux_applications_user_client_id
  ON applications (user_id, client_id);

-- Step 6: job_dismissals is currently global (`url text PRIMARY
-- KEY`, no user_id) — a hidden role for one user would hide it
-- for everyone post-cutover. Add user_id + composite PK + RLS-
-- ready shape. Backfill existing rows to the bootstrap user.
ALTER TABLE job_dismissals
  ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE job_dismissals
   SET user_id = :'bootstrap_user_id'
 WHERE user_id IS NULL;
ALTER TABLE job_dismissals
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT job_dismissals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- Swap PK from (url) to (user_id, url) so each user has their own
-- hidden-roles list.
ALTER TABLE job_dismissals DROP CONSTRAINT IF EXISTS job_dismissals_pkey;
ALTER TABLE job_dismissals
  ADD CONSTRAINT job_dismissals_pkey
    PRIMARY KEY (user_id, url);

COMMIT;
```

### 0015_rls_policies.sql

```sql
-- 0015_rls_policies.sql
-- Enable RLS on every user-scoped table + own-only policies.

BEGIN;

-- Idempotency guards — drop any prior policies / triggers first so
-- a partially-failed 0015 run can be safely re-applied without
-- "already exists" noise. We don't use IF NOT EXISTS on CREATE
-- POLICY because Postgres < 17 doesn't support it on policies.
DROP POLICY IF EXISTS user_profile_select_own ON user_profile;
DROP POLICY IF EXISTS user_profile_insert_own ON user_profile;
DROP POLICY IF EXISTS user_profile_update_own ON user_profile;
DROP POLICY IF EXISTS user_profile_delete_own ON user_profile;
DROP POLICY IF EXISTS user_tracks_select_own ON user_tracks;
DROP POLICY IF EXISTS user_tracks_insert_own ON user_tracks;
DROP POLICY IF EXISTS user_tracks_update_own ON user_tracks;
DROP POLICY IF EXISTS user_tracks_delete_own ON user_tracks;
DROP POLICY IF EXISTS user_email_accounts_select_own ON user_email_accounts;
DROP POLICY IF EXISTS user_email_accounts_insert_own ON user_email_accounts;
DROP POLICY IF EXISTS user_email_accounts_update_own ON user_email_accounts;
DROP POLICY IF EXISTS user_email_accounts_delete_own ON user_email_accounts;
DROP POLICY IF EXISTS user_context_notes_select_own ON user_context_notes;
DROP POLICY IF EXISTS user_context_notes_insert_own ON user_context_notes;
DROP POLICY IF EXISTS user_context_notes_update_own ON user_context_notes;
DROP POLICY IF EXISTS user_context_notes_delete_own ON user_context_notes;
DROP POLICY IF EXISTS applications_select_own ON applications;
DROP POLICY IF EXISTS applications_insert_own ON applications;
DROP POLICY IF EXISTS applications_update_own ON applications;
DROP POLICY IF EXISTS applications_delete_own ON applications;
DROP POLICY IF EXISTS events_select_via_application ON events;
DROP POLICY IF EXISTS events_insert_via_application ON events;
DROP POLICY IF EXISTS job_dismissals_select_own ON job_dismissals;
DROP POLICY IF EXISTS job_dismissals_insert_own ON job_dismissals;
DROP POLICY IF EXISTS job_dismissals_delete_own ON job_dismissals;
DROP TRIGGER IF EXISTS user_profile_force_caller_uid ON user_profile;
DROP TRIGGER IF EXISTS user_tracks_force_caller_uid ON user_tracks;
DROP TRIGGER IF EXISTS user_email_accounts_force_caller_uid ON user_email_accounts;
DROP TRIGGER IF EXISTS user_context_notes_force_caller_uid ON user_context_notes;
DROP TRIGGER IF EXISTS applications_force_caller_uid ON applications;
DROP TRIGGER IF EXISTS job_dismissals_force_caller_uid ON job_dismissals;

ALTER TABLE user_profile         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_dismissals       ENABLE ROW LEVEL SECURITY;

-- Macro-like: same four policies per table.
-- (psql doesn't have user-defined macros so we just repeat.)

-- user_profile
CREATE POLICY user_profile_select_own ON user_profile
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_profile_insert_own ON user_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_profile_update_own ON user_profile
  FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_profile_delete_own ON user_profile
  FOR DELETE USING (auth.uid() = user_id);

-- user_tracks (same 4)
CREATE POLICY user_tracks_select_own ON user_tracks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_tracks_insert_own ON user_tracks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_tracks_update_own ON user_tracks
  FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_tracks_delete_own ON user_tracks
  FOR DELETE USING (auth.uid() = user_id);

-- user_email_accounts (same 4)
CREATE POLICY user_email_accounts_select_own ON user_email_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_email_accounts_insert_own ON user_email_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_email_accounts_update_own ON user_email_accounts
  FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_email_accounts_delete_own ON user_email_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- user_context_notes (same 4)
CREATE POLICY user_context_notes_select_own ON user_context_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_context_notes_insert_own ON user_context_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_context_notes_update_own ON user_context_notes
  FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_context_notes_delete_own ON user_context_notes
  FOR DELETE USING (auth.uid() = user_id);

-- applications (same 4)
CREATE POLICY applications_select_own ON applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY applications_insert_own ON applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY applications_update_own ON applications
  FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY applications_delete_own ON applications
  FOR DELETE USING (auth.uid() = user_id);

-- events: scoped via application_id JOIN. Append-only by design
-- (events are immutable audit trail). UPDATE + DELETE are NOT
-- policy'd → effectively forbidden once RLS is on; the only way
-- to "delete" an event is to delete the parent application, which
-- cascades. This is the right model for an audit log.
CREATE POLICY events_select_via_application ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = events.application_id
        AND a.user_id = auth.uid()
    )
  );
CREATE POLICY events_insert_via_application ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = events.application_id
        AND a.user_id = auth.uid()
    )
  );

-- job_dismissals own-only policies (no UPDATE — dismissals are
-- toggle: insert to dismiss, delete to un-dismiss).
CREATE POLICY job_dismissals_select_own ON job_dismissals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY job_dismissals_insert_own ON job_dismissals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY job_dismissals_delete_own ON job_dismissals
  FOR DELETE USING (auth.uid() = user_id);

-- RLS-performance note: the EXISTS subquery in the events policies
-- re-runs on every row scan. Required indexes (verify present
-- before applying):
--   * events.application_id        (already exists per 0001)
--   * applications(id, user_id)    (composite; not yet present)
-- 0014 above already creates a per-user real index on
-- applications. Add an explicit composite for the RLS hot path:
CREATE INDEX IF NOT EXISTS applications_id_user_id_idx
  ON applications (id, user_id);

-- Defense-in-depth: BEFORE INSERT trigger that overwrites any
-- client-supplied user_id with auth.uid(). Belt-and-braces — the
-- WITH CHECK RLS policy ALREADY blocks INSERTs where the
-- client-supplied user_id ≠ auth.uid(), but a trigger is cheap
-- and means even a misconfigured RLS state (policies dropped
-- accidentally) wouldn't allow user-impersonation writes.
--
-- Applies to every user-scoped table. Pattern is identical so we
-- generate it once via a plpgsql function + a per-table trigger.

CREATE OR REPLACE FUNCTION enforce_user_id_is_caller()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_id := auth.uid();
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required to insert into %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER user_profile_force_caller_uid
  BEFORE INSERT ON user_profile
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();
CREATE TRIGGER user_tracks_force_caller_uid
  BEFORE INSERT ON user_tracks
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();
CREATE TRIGGER user_email_accounts_force_caller_uid
  BEFORE INSERT ON user_email_accounts
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();
CREATE TRIGGER user_context_notes_force_caller_uid
  BEFORE INSERT ON user_context_notes
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();
CREATE TRIGGER applications_force_caller_uid
  BEFORE INSERT ON applications
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();
CREATE TRIGGER job_dismissals_force_caller_uid
  BEFORE INSERT ON job_dismissals
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_is_caller();

COMMIT;
```

**Note on the INSERT trigger + edge functions:** the trigger uses
`auth.uid()` which evaluates to the JWT claim on the request.
Edge functions that use the service-role key (catalog reads) DO
NOT call `auth.uid()` paths and will never write to user-scoped
tables anyway — they only `SELECT` from `jobs` / `vcs`. Edge
functions that write user-scoped data MUST forward the user's
JWT (via `Authorization: Bearer` on a `createClient(URL, anonKey,
{ global: { headers: { Authorization: ... } } })` invocation) so
`auth.uid()` is set correctly inside the trigger.

### Pre-migration runbook
1. Dev user signs up via Supabase dashboard (email magic link) →
   note the resulting `auth.users.id` UUID.
2. Run `psql ... -v bootstrap_user_id='<uuid>' -f 0014_auth_user_id_fk.sql`.
3. Run `psql ... -f 0015_rls_policies.sql` (no params).
4. Mirror both to `supabase/migrations/<ts>_*.sql`.
5. Apply via `migrate.py` (already supports param-less SQL; needs
   one-off psql invocation for 0014 since it takes a variable).
6. Verify: smoke-test SELECTs as the dev user via the JS client.

## Library plan (B territory)

### src/lib/auth.ts — NEW
```ts
export async function getCurrentUserId(): Promise<string | null>
export async function signInWithEmail(email: string): Promise<void>  // magic link
export async function signInWithGoogle(): Promise<void>
export async function signOut(): Promise<void>
export function onAuthChange(cb: (uid: string | null) => void): () => void
```

Tests: mocked Supabase auth client, exhaustive callback / error paths.

### Update src/lib/profile-store.ts
- `setProfileFromAnalysis(analysis, filename)` writes `user_id =
  await getCurrentUserId()` instead of null. If null → still write
  to localStorage but skip Supabase upsert (anonymous mode).
- `initProfileFromSupabase()` queries by `auth.uid()` not by
  `is("user_id", null)`.
- New `migrateLocalStorageToSupabase()` — one-shot. On first
  authenticated load, if localStorage has profile/tracks AND
  Supabase rows are empty, upsert into Supabase under the new
  user_id. Idempotency flag in localStorage.

### Update src/lib/cinema-theme.ts persistTheme + fetchPersistedTheme
- `persistTheme(theme)` writes `user_id = auth.uid()`.
- `fetchPersistedTheme()` queries via session (`is("user_id",
  null)` becomes implicit via RLS — actually drop the .is() call,
  RLS does the scoping).

### Update src/lib/context-notes.ts
- `saveContextNote(text, source?, metadata?)` writes `user_id =
  auth.uid()`.
- `fetchRecentContextNotes(limit)` drops the `.is("user_id",
  null)` filter (RLS handles it).

### Update src/components/CareerBuddy.tsx applications.upsert path
- `applicationToRow(a)` now sets `user_id = await
  getCurrentUserId()` (or upstream caller passes it in).

### Edge functions — minimal change
- Each function reads `req.headers.get("authorization")`, validates
  the JWT via Supabase, derives `user_id`. Reject 401 if missing.
- Helper: `getAuthUserId(req): Promise<string | null>`.

## Frontend plan (A territory — for the handoff)

- New route `src/routes/login.tsx` — magic-link + Google buttons.
  Listens for auth-change → redirects to `/`.
- `<RootShell />` gate: on mount, check `getCurrentUserId()`. If
  null AND path != `/login` → redirect.
- Cinema chrome top-right: logout pill when signed-in, "Sign in"
  pill when anonymous (linking to /login).
- LocalStorage migration trigger: in RootShell mount, after
  session loads, call `migrateLocalStorageToSupabase()` once.

## Test plan

### New (B)
- `src/lib/auth.test.ts` — mock Supabase auth, cover sign-in /
  sign-out / change handler.
- `src/lib/profile-store.test.ts` — extend with auth-aware writes
  + migration path tests.
- `src/lib/cinema-theme.test.ts` (B owns the supabase wrappers
  even though theme picker is A's): test fetchPersistedTheme +
  persistTheme with auth scoping.
- `src/lib/context-notes.test.ts` — drop the `.is("user_id",
  null)` assertion; assert real user_id propagation.
- Edge-function unit tests via deno test or a thin python harness.

### New (A — gets test follow-up from B)
- `src/routes/login.test.tsx` — magic-link button, Google button,
  redirect on auth.
- `src/components/cinema/AuthGate.test.tsx` — redirect logic.

### Smoke
- Manual: sign up, see profile load, log out, sign back in, same
  data.
- Manual: sign up second test user, verify they CANNOT see first
  user's data (RLS check).
- Add to `scripts/smoke-routes.sh` if applicable.

## Commit / rollout order

1. **Commit 1 (B):** plan doc (this file) + Supabase Auth provider
   config note (manual dashboard step).
2. **Commit 2 (B):** `src/lib/auth.ts` + tests (no UI yet, just
   the helper).
3. **Commit 3 (B):** 0014 migration (drafted but NOT yet applied —
   needs bootstrap_user_id from step 0).
4. **Commit 4 (B):** 0015 RLS policies (drafted, NOT applied).
5. **Manual step (user):** sign up via dashboard, capture UUID,
   apply 0014 + 0015 via psql, mirror to supabase/migrations.
6. **Commit 5 (B):** lib updates (profile-store, cinema-theme,
   context-notes) + migrateLocalStorageToSupabase + tests.
7. **Commit 6 (B):** edge functions JWT validation + tests.
8. **Commit 7 (A):** `/login` route + AuthGate + logout pill +
   RTL tests (B follows with tests as usual).
9. **Manual smoke (user):** end-to-end sign-up/sign-in/sign-out
   loop, two-user RLS check.
10. **Commit 8 (B):** cleanup — drop COALESCE comments in older
    migrations (paid down by 0014), refresh CLAUDE_COORDINATION.md
    boundaries (user_id NULL convention obsolete).

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Bootstrap UUID drift between psql + JS client | Hard-fail 0014 if `:bootstrap_user_id` unset; document the runbook step |
| LocalStorage migration races (two tabs) | `BroadcastChannel` lock OR keep idempotent (last-write-wins is fine for v1) |
| RLS breaks edge functions silently | Edge functions use service-role key for admin ops (jobs catalog reads) but USER key for user-scoped writes; review each function |
| Anonymous mode regression | `getCurrentUserId() → null` paths preserved in all libs; localStorage still works for read |
| Existing applications-user_id FK to public.users (legacy users table) | Migration drops it first, then re-creates against auth.users |
| Supabase Auth email delivery flaky | Magic links are sent via Supabase's mailer; document that the dev user must configure SMTP in dashboard if testing on personal email |

## Effort estimate

- Plan + codex review: **2h** (this session)
- Lib `src/lib/auth.ts` + tests: **3h**
- Migrations 0014 + 0015 + dry-run on a Supabase branch DB: **3h**
- Lib updates + tests: **4h**
- Edge functions JWT validation: **3h**
- A's UI (login route + AuthGate + logout): **4-6h**
- Manual smoke: **1h**

**Total: ~20-25h** across A + B sessions. Realistic 2-3 calendar
days if both sessions run.

## Anonymous-mode contract (resolved — was open)

**Decision (auto-resolved to remove the contradiction codex flagged):**

- **`/jobs` IS public-readable.** Job catalog (`jobs`, `vcs`)
  tables stay public-SELECT (no RLS enabled on them). Lets a
  curious visitor browse roles before signing up.
- **Every other user-scoped route is gated.** `/`, `/profile`,
  `/buddy`, `/cv`, `/applications` redirect to `/login` if no
  session. AuthGate component handles this centrally; no
  per-route check sprinkled.
- **AuthGate behavior on `/jobs`:** lets the page render
  without a session, BUT hides the per-role "dismiss" and
  "track interest" CTAs (which need INSERT on `job_dismissals`
  / `applications`). Signed-out users see a "Sign in to track"
  pill in the chrome.
- **LocalStorage is anonymous-only.** Once signed in, all writes
  go through Supabase (with the localStorage write kept as
  offline-cache). On sign-out, localStorage stays — that's the
  user's last-good-state cache for the next anonymous visit if
  any.

## Open questions before execute

1. ~~Email-magic-link only or Google OAuth day-1 too?~~ **Both
   (user already answered up-thread).**
2. ~~Anonymous mode~~ — resolved above.
3. Pre-existing `public.users` legacy table — plan drops it as
   part of 0014 with a four-class dependency guard.
4. ~~RLS for `jobs` + `vcs` catalogs~~ — resolved above: public.
