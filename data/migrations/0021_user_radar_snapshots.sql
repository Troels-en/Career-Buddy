-- 0021_user_radar_snapshots.sql
-- F2 — append-only CV radar snapshots.
--
-- Each CV analysis writes one row: the 6-axis radar scores plus the
-- strengths / weaknesses / gaps the LLM produced for that upload.
-- Append-only by design (no UPDATE / DELETE policy) so the history
-- is queryable for a future fit-trajectory trend. Latest row wins
-- for display.

BEGIN;

CREATE TABLE IF NOT EXISTS user_radar_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  source_cv_filename text,
  axes jsonb NOT NULL,
  strengths jsonb NOT NULL,
  weaknesses jsonb NOT NULL,
  gaps jsonb NOT NULL
);

ALTER TABLE user_radar_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_radar_snapshots_self_read ON user_radar_snapshots;
CREATE POLICY user_radar_snapshots_self_read ON user_radar_snapshots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_radar_snapshots_self_insert ON user_radar_snapshots;
CREATE POLICY user_radar_snapshots_self_insert ON user_radar_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policy: append-only.

CREATE INDEX IF NOT EXISTS user_radar_snapshots_user_captured
  ON user_radar_snapshots (user_id, captured_at DESC);

COMMIT;
