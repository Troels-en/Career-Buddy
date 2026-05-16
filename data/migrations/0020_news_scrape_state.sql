-- 0020_news_scrape_state.sql
-- F3 — per-day state for the company-news RSS cron.
--
-- Fills the migration gap reserved between F1 and F2. Currently holds
-- one row per UTC day tracking how many LLM relevance calls the cron
-- has spent, so the 25-call/day circuit-breaker survives crashes and
-- same-day re-runs.
--
-- RLS is enabled with NO policies: neither anon nor authenticated
-- clients can read or write this table. Only the nightly cron's
-- privileged `SUPABASE_DB_URL` connection (which bypasses RLS) touches
-- it — so the breaker count cannot be forged via the public anon key.

BEGIN;

CREATE TABLE IF NOT EXISTS news_scrape_state (
  day date PRIMARY KEY,
  llm_calls integer NOT NULL DEFAULT 0
);

ALTER TABLE news_scrape_state ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: cron-only, via the privileged connection.

COMMIT;
