-- Mirror of data/migrations/0011_user_tracks.sql for the Supabase CLI.

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

CREATE UNIQUE INDEX IF NOT EXISTS user_tracks_user_id_idx
    ON user_tracks (COALESCE(user_id::text, ''));

COMMENT ON TABLE  user_tracks                  IS 'Per-user track selection — drives Phase 4 cinema-theme swap.';
COMMENT ON COLUMN user_tracks.user_id          IS 'NULL for the single-user app; becomes mandatory when multi-tenant auth lands.';
COMMENT ON COLUMN user_tracks.track_primary    IS 'Active theme: sage | onyx | slate | coral.';
COMMENT ON COLUMN user_tracks.track_secondary  IS 'Additional tracks — TRACKS ids from src/lib/tracks.ts.';
