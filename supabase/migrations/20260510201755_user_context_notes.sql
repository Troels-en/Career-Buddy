-- 20260510201755_user_context_notes.sql
-- Mirror of data/migrations/0013_user_context_notes.sql for the
-- supabase CLI workflow. See the data/ file for column-level comments.

CREATE TABLE IF NOT EXISTS user_context_notes (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid          NULL,
    note_text   text          NOT NULL,
    source      text          NOT NULL DEFAULT 'buddy',
    metadata    jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_context_notes_user_recent_idx
    ON user_context_notes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_context_notes_source_idx
    ON user_context_notes (source);

COMMENT ON TABLE  user_context_notes              IS 'Auto-context notes generated from Buddy conversations + profile edits (Phase 5).';
COMMENT ON COLUMN user_context_notes.user_id      IS 'NULL for the single-user app; becomes mandatory when multi-tenant auth lands.';
COMMENT ON COLUMN user_context_notes.source       IS 'Origin tag: buddy | profile | cv | manual. Free-form; validated client-side.';
COMMENT ON COLUMN user_context_notes.metadata     IS 'Opaque JSONB — conversation_id, referenced job_id, message ids, etc.';
