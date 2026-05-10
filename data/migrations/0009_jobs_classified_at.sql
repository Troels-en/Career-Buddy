-- 0009_jobs_classified_at.sql
-- Per-job provenance for role-category classification.
-- Lets us answer "who classified this row, when?" and supports precise
-- per-row rollback without grepping audit CSVs.
--
-- Backfill of pre-existing rows is intentionally NOT done here — those
-- rows have NULL classified_at + classified_source. New writes from
-- cli.classify and cli.classify_tier2_claude populate both columns.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS classified_at      timestamptz,
    ADD COLUMN IF NOT EXISTS classified_source  text;

CREATE INDEX IF NOT EXISTS jobs_classified_at_idx
    ON jobs (classified_at)
    WHERE classified_at IS NOT NULL;
