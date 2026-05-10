-- 0012_user_profile.sql
-- Canonical Supabase persistence for the CV-analyzed profile.
-- Mirrors the localStorage `career-buddy-state.profile` shape so
-- analyze-cv output can survive across devices once auth lands.
--
-- skills is first-class JSONB so we can query containment + index it
-- via GIN for future skill-search queries (e.g. roles needing a
-- specific tech). Each element matches:
--   { name: string, level?: string, years?: number, evidence?: string }
--
-- work_history mirrors src/lib/types.ts `Position[]`,
-- education mirrors `Education[]`. Both stored JSONB to keep the row
-- shape stable while the rich-text shapes evolve in the frontend.
--
-- user_id NULL today (single-user phase, same convention as
-- 0010 / 0011). Unique-per-user enforced via partial-COALESCE index
-- so the single-user app keeps one row + multi-tenant later swaps to
-- enforce one row per real user.

CREATE TABLE IF NOT EXISTS user_profile (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid          NULL,
    name                    text          NULL,
    headline                text          NULL,
    summary                 text          NULL,
    skills                  jsonb         NOT NULL DEFAULT '[]'::jsonb,
    work_history            jsonb         NOT NULL DEFAULT '[]'::jsonb,
    education               jsonb         NOT NULL DEFAULT '[]'::jsonb,
    target_role             text          NULL,
    target_geo              text          NULL,
    target_role_categories  text[]        NOT NULL DEFAULT '{}',
    location_preferences    text[]        NOT NULL DEFAULT '{}',
    cv_filename             text          NULL,
    cv_summary              text          NULL,
    cv_fit_score            numeric       NULL,
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now()
);

-- One profile row per user (unique-per-user via partial-COALESCE on
-- nullable user_id, matches 0010 / 0011 single-user shape).
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_user_id_idx
    ON user_profile (COALESCE(user_id::text, ''));

-- GIN index on skills JSONB for skill-search containment queries
-- (e.g. WHERE skills @> '[{"name": "Python"}]'::jsonb).
CREATE INDEX IF NOT EXISTS user_profile_skills_gin_idx
    ON user_profile USING GIN (skills);

COMMENT ON TABLE  user_profile                         IS 'Canonical Supabase persistence for CV-analyzed profile (round 7+ ask).';
COMMENT ON COLUMN user_profile.user_id                 IS 'NULL for the single-user app; becomes mandatory when multi-tenant auth lands.';
COMMENT ON COLUMN user_profile.skills                  IS 'JSONB array of {name, level?, years?, evidence?} objects. Queryable via JSONB containment. GIN-indexed.';
COMMENT ON COLUMN user_profile.work_history            IS 'JSONB array of Position-shaped objects (mirror of src/lib/types.ts).';
COMMENT ON COLUMN user_profile.education               IS 'JSONB array of Education-shaped objects (mirror of src/lib/types.ts).';
COMMENT ON COLUMN user_profile.target_role_categories  IS 'Track ids the user is targeting (TRACKS from src/lib/tracks.ts).';
COMMENT ON COLUMN user_profile.location_preferences    IS 'Free-text location preferences (e.g. Berlin, Remote-DACH).';
