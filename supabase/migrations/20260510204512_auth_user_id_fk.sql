-- 0014_auth_user_id_fk.sql
-- Multi-user cutover: every user-scoped table gets real FK to
-- auth.users + the COALESCE-based unique-index pattern is replaced
-- with real per-user unique indexes. Existing NULL rows reassign
-- to a bootstrap dev-user UUID passed in via psql variable.
--
-- DO NOT apply via the migrate CLI — this migration needs a psql
-- variable. Run manually:
--
--   psql "$SUPABASE_DB_URL" \
--        -v bootstrap_user_id="'<auth.users.id from dashboard>'" \
--        -f data/migrations/0014_auth_user_id_fk.sql
--
-- After 0014 applies cleanly, re-run the migrate CLI which will
-- mark 0014 in `_migrations` so it isn't double-applied.
--
-- Plan-of-record: docs/MULTI_USER_RLS_PLAN.md (10/10 codex-reviewed
-- v6, 2026-05-10 night).

\if :{?bootstrap_user_id}
\else
  \echo 'ERROR: pass -v bootstrap_user_id="<uuid>" on psql command line'
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
-- after the backfill — means a new table was added without
-- updating this migration.
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

-- Step 2: drop the COALESCE-based "one row per user" unique
-- indexes (they used the magic '' fallback for single-user phase).
DROP INDEX IF EXISTS user_profile_user_id_idx;
DROP INDEX IF EXISTS user_tracks_user_id_idx;
DROP INDEX IF EXISTS user_email_accounts_user_email_idx;
DROP INDEX IF EXISTS user_email_accounts_one_primary_per_user_idx;

-- Step 3: NOT NULL + FK to auth.users on the four user-scoped tables.
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
-- to the bootstrap user.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_user_id_fkey;
UPDATE applications SET user_id = :'bootstrap_user_id';
ALTER TABLE applications
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT applications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the legacy public.users table — pre-Supabase-Auth artefact,
-- no longer referenced after the FK above repoints to auth.users.
-- Four-class dependency guard (FKs, views, functions, triggers)
-- before drop; RESTRICT (not CASCADE) so a slipped 5th-class
-- dependency type aborts loudly rather than silently collateral-
-- dropping.
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
-- Repoint the constraint to (user_id, client_id) FULL (not partial)
-- so PostgREST `onConflict: "user_id,client_id"` can target it.
UPDATE applications
   SET client_id = 'legacy_' || id::text
 WHERE client_id IS NULL;
ALTER TABLE applications ALTER COLUMN client_id SET NOT NULL;
DROP INDEX IF EXISTS ux_applications_client_id;
CREATE UNIQUE INDEX ux_applications_user_client_id
  ON applications (user_id, client_id);

-- Step 6: job_dismissals is currently global (`url text PRIMARY
-- KEY`, no user_id) — a hidden role for one user would hide it
-- for everyone post-cutover. Add user_id + composite PK +
-- RLS-ready shape. Backfill existing rows to the bootstrap user.
ALTER TABLE job_dismissals
  ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE job_dismissals
   SET user_id = :'bootstrap_user_id'
 WHERE user_id IS NULL;
ALTER TABLE job_dismissals
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT job_dismissals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE job_dismissals DROP CONSTRAINT IF EXISTS job_dismissals_pkey;
ALTER TABLE job_dismissals
  ADD CONSTRAINT job_dismissals_pkey
    PRIMARY KEY (user_id, url);

-- Step 7: composite index on applications(id, user_id) for the
-- events RLS EXISTS subquery hot path (see 0015).
CREATE INDEX IF NOT EXISTS applications_id_user_id_idx
  ON applications (id, user_id);

COMMIT;

-- Mark 0014 applied in the migration tracker so the migrate CLI
-- treats it as a no-op on future runs. This INSERT happens
-- OUTSIDE the transaction so a subsequent migrate run picks it up
-- even if the operator forgets to register it.
INSERT INTO _migrations (filename) VALUES ('0014_auth_user_id_fk.sql')
ON CONFLICT (filename) DO NOTHING;
