-- 0018_user_feed_state.sql
-- F1 — per-user "last time I viewed the news feed" anchor.
--
-- Used by the /news route to compute the "new since last visit"
-- bucket. Server-side so the badge stays honest across devices.

BEGIN;

CREATE TABLE IF NOT EXISTS user_feed_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_feed_view_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_feed_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_feed_state_self_read ON user_feed_state;
CREATE POLICY user_feed_state_self_read ON user_feed_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_feed_state_self_insert ON user_feed_state;
CREATE POLICY user_feed_state_self_insert ON user_feed_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_feed_state_self_update ON user_feed_state;
CREATE POLICY user_feed_state_self_update ON user_feed_state
  FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMIT;
