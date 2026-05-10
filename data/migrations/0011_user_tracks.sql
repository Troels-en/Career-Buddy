-- 0011_user_tracks.sql
-- Per-user track selection — drives Phase 4 step 3 theming
-- (<html data-theme="..."> reads user.track_primary).
--
-- track_primary: one of sage | onyx | slate | coral. Default 'sage'
-- so existing pages stay on the current palette until the user picks.
-- track_secondary: text[] of additional tracks the user is open to —
-- multi-select chip catalogue (TRACKS from src/lib/tracks.ts).
--
-- user_id is nullable for the current single-user app, mandatory once
-- multi-tenant auth lands. Same convention as 0010_user_email_accounts.

CREATE TABLE IF NOT EXISTS user_tracks (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid          NULL,
    track_primary   text          NOT NULL DEFAULT 'sage',
    track_secondary text[]        NOT NULL DEFAULT '{}',
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT user_tracks_primary_check
        CHECK (track_primary IN ('sage', 'onyx', 'slate', 'coral'))
);

-- One track row per user (unique-per-user via partial-COALESCE on
-- nullable user_id, same shape as 0010 to keep single-user phase clean).
CREATE UNIQUE INDEX IF NOT EXISTS user_tracks_user_id_idx
    ON user_tracks (COALESCE(user_id::text, ''));

COMMENT ON TABLE  user_tracks                  IS 'Per-user track selection — drives Phase 4 cinema-theme swap.';
COMMENT ON COLUMN user_tracks.user_id          IS 'NULL for the single-user app; becomes mandatory when multi-tenant auth lands.';
COMMENT ON COLUMN user_tracks.track_primary    IS 'Active theme: sage | onyx | slate | coral. Read by <RootShell> for <html data-theme>.';
COMMENT ON COLUMN user_tracks.track_secondary  IS 'Additional tracks the user is open to — TRACKS ids from src/lib/tracks.ts.';
