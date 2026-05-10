-- 0013_user_context_notes.sql
-- Auto-context notes generated from Buddy conversations + profile
-- edits. Phase 5 of cinema-personalisation: as the user chats,
-- Buddy quietly persists structured takeaways back to Supabase so
-- future sessions (and future devices) carry the same context
-- without re-asking.
--
-- source: free-form tag — 'buddy' (chat summarise), 'profile'
--   (manual note on /profile), 'cv' (extracted during analyze-cv),
--   'manual' (user-typed note). Validated client-side; no DB CHECK
--   so we can add new sources without a migration.
-- metadata: flexible JSONB — conversation_id, message ids,
--   referenced job_id, etc. Stays opaque to the DB.
--
-- user_id NULL today (single-user phase, same convention as
-- 0010 / 0011 / 0012). Becomes mandatory + RLS-scoped once
-- multi-tenant auth lands.
--
-- No COALESCE-unique-index this time: many notes per user are
-- expected (one row per chat-summary, one row per profile-edit
-- breadcrumb, etc.).

CREATE TABLE IF NOT EXISTS user_context_notes (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid          NULL,
    note_text   text          NOT NULL,
    source      text          NOT NULL DEFAULT 'buddy',
    metadata    jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz   NOT NULL DEFAULT now()
);

-- Hot path: "give me this user's last 20 notes, newest first" —
-- powers the Buddy context-load on next session.
CREATE INDEX IF NOT EXISTS user_context_notes_user_recent_idx
    ON user_context_notes (user_id, created_at DESC);

-- Source filter (e.g. "show me only CV-derived notes") — small index.
CREATE INDEX IF NOT EXISTS user_context_notes_source_idx
    ON user_context_notes (source);

COMMENT ON TABLE  user_context_notes              IS 'Auto-context notes generated from Buddy conversations + profile edits (Phase 5).';
COMMENT ON COLUMN user_context_notes.user_id      IS 'NULL for the single-user app; becomes mandatory when multi-tenant auth lands.';
COMMENT ON COLUMN user_context_notes.source       IS 'Origin tag: buddy | profile | cv | manual. Free-form; validated client-side.';
COMMENT ON COLUMN user_context_notes.metadata     IS 'Opaque JSONB — conversation_id, referenced job_id, message ids, etc.';
