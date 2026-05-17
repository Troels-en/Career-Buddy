# 0005 — Candidate Memory v1: build spec

Companion to [0005-candidate-memory-layer.md](0005-candidate-memory-layer.md) (the ADR).
This document is the build-ready specification: schema, write-path SQL functions, fact
taxonomy, synthesis pipeline, evidence/confidence model, Context Card, edge-function
contracts, UI, GDPR surface, backfill, test plan, and rollout. Read the ADR first for
the *why*.

- **Status:** Accepted — ready to build
- **Date:** 2026-05-17
- **Scope:** Candidate Memory v1. Deferred items are in §13.

---

## 1. Overview

Candidate Memory is a layer of **atomic facts** about the candidate, stored in Supabase
Postgres. Two hard architectural rules drive the whole design:

1. **Reads are direct; writes are not.** Clients (the frontend, edge functions) `SELECT`
   the fact tables directly under row-level security. They **never** `INSERT` / `UPDATE`
   / `DELETE` them. Every write goes through a `SECURITY DEFINER` SQL function that owns
   the evidence, confidence, provenance, and staging rules. The fact tables grant no
   write privilege to `anon` or `authenticated`, so the rules cannot be bypassed.
2. **Chat never writes facts.** Chat-derived facts become rows in
   `candidate_fact_suggestions` — a review queue. They become real facts only when the
   user accepts them. This is enforced at the database boundary: the only client-callable
   function that can write a fact (`cm_apply_fact`) hard-codes `source = 'manual'`, and
   the import function (`cm_apply_facts`) rejects `'chat'`.

```
sources ─▶ extract ─▶ validate ─▶ write/stage ───────────▶ readers
 LinkedIn    LLM       server      cm_apply_facts()  ─▶ candidate_facts
 CV upload  (import)  (pure,       cm_stage_suggestions() ─▶ candidate_fact_suggestions
 chat turn  (fenced    deterministic)         │                    │
 manual      JSON)                            ▼                    ▼ user accepts
                                       candidate_fact_evidence   cm_accept_suggestion()
                                                                     │
                                       Context Card ◀────────────────┘
                                  _shared/context-card.ts
                                  ─▶ chat / analyze-cv / draft-message / match-job
```

Four new tables, one immutable helper, one private worker function and seven public
write-path functions, two shared edge-function modules, modifications to four existing
edge functions, one new frontend route, one backfill.

### 1.1 Sections

Facts are grouped into **seven stored sections** plus **one projected section**:

| Section | Stored? | Contents |
|---|---|---|
| `profile` | stored | name, headline, summary, narrative themes |
| `experience` | stored | work positions, tenure, domains, education |
| `skills` | stored | one fact per skill, with level/years |
| `preferences` | stored | remote mode, company stage, culture, role type |
| `job_search_goals` | stored | target roles, target geos, timeline, seniority aim |
| `constraints` | stored | salary floor, location limits, visa, companies to avoid |
| `assistant_notes` | stored | Buddy's working inferences, labelled as inferred |
| `application_history` | **projected** | derived live from the `applications` table |

`application_history` is **not** a `candidate_facts` section. Wrapping the existing
`applications` table as duplicated facts is the "reference, don't wrap" trap from the
ADR. The Context Card composes an `application_history` block live from `applications`
at render time (§6); the Buddy's Brain UI shows it read-only. The
`candidate_facts.section` CHECK allows the **seven stored sections only**.

> **Scope note (carried back to the feature file):** `Feature_Candidate_Memory.md` lists
> `application_history` as a `candidate_context` section and treats education
> separately. v1 projects `application_history` rather than storing it, and folds
> education into the `experience` section. Both are recorded as scope changes in the
> feature file link-back.

---

## 2. Data model — migration `0024_candidate_memory.sql`

One schema migration (`0024`) for tables + functions; one backfill migration (`0025`,
§10). Numbers are **provisional** — claim them at merge time against `origin/main` and
the active WORKPLAN migration map (per the `db-migrations` skill). At time of writing
`main` is at `0023`; the WhatsApp branch holds `0026`; `0024`/`0025` are free. Each
migration is dual-filed: canonical `data/migrations/NNNN_slug.sql` + Supabase mirror
`supabase/migrations/20260517HHMMSS_slug.sql` with identical SQL and a
`-- NNNN_slug.sql (mirror)` first line.

`0024` reuses `set_updated_at()` (migration 0002) — it must sort after `0002`. It does
**not** reuse the 0015 `enforce_user_id_is_caller()` trigger (there is no direct INSERT
path to protect — §2.3). `0025` reads `user_profile` and writes `candidate_facts`, so it
sorts after both `0012` and `0024`. Both satisfy the ALTER-sorts-after-CREATE rule.

The whole of `0024` is **one transaction** (`BEGIN; … COMMIT;`) — the repo convention
(0015/0021/0022/0023) and what the migrate CLI expects (one transaction per file).

### 2.1 Tables

```sql
-- 0024_candidate_memory.sql
-- Candidate Memory layer: atomic facts + provenance + staged suggestions +
-- delete tombstones, plus the SECURITY DEFINER write-path functions.
-- See docs/decisions/0005-candidate-memory-layer.md and the build spec.
--
-- Reuses set_updated_at() (0002); MUST sort after 0002.
-- Idempotent: every CREATE is IF NOT EXISTS or preceded by DROP IF EXISTS.

BEGIN;

-- ── candidate_facts ────────────────────────────────────────────────────────
-- One row per atomic claim. Exactly one row per (user, section, fact_key);
-- the write functions update in place — there are no superseded history rows.
CREATE TABLE IF NOT EXISTS candidate_facts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section        text        NOT NULL,
  fact_key       text        NOT NULL,
  fact_value     jsonb       NOT NULL,
  label          text        NOT NULL,
  confidence     text        NOT NULL DEFAULT 'inferred',
  evidence_count integer     NOT NULL DEFAULT 1,   -- count(*) of evidence rows
  source         text        NOT NULL,             -- source of the most recent write
  user_verified  boolean     NOT NULL DEFAULT false,
  first_seen     timestamptz NOT NULL DEFAULT now(),
  last_seen      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_facts_uq          UNIQUE (user_id, section, fact_key),
  CONSTRAINT candidate_facts_id_user_uq  UNIQUE (id, user_id),   -- composite-FK target
  CONSTRAINT candidate_facts_section_chk CHECK (section IN
    ('profile','experience','skills','preferences',
     'job_search_goals','constraints','assistant_notes')),
  CONSTRAINT candidate_facts_confidence_chk CHECK (confidence IN
    ('stated','inferred','corroborated')),
  CONSTRAINT candidate_facts_source_chk CHECK (source IN
    ('linkedin_onboarding','cv_upload','chat','manual','system')),
  -- Structural bounds:
  CONSTRAINT candidate_facts_key_chk   CHECK (fact_key ~ '^[a-z0-9][a-z0-9:_-]{0,254}$'),
  CONSTRAINT candidate_facts_label_chk CHECK (char_length(label) BETWEEN 1 AND 200),
  CONSTRAINT candidate_facts_value_chk CHECK (jsonb_typeof(fact_value) = 'object'),
  CONSTRAINT candidate_facts_value_size_chk CHECK (octet_length(fact_value::text) <= 4096),
  CONSTRAINT candidate_facts_evidence_count_chk CHECK (evidence_count >= 1),
  -- Taxonomy boundary (§3): fixed-key sections are enum-checked here in SQL;
  -- dynamic-key sections are pattern-checked. The TS FACT_TAXONOMY enforces the
  -- same key set plus the fact_value shapes.
  CONSTRAINT candidate_facts_taxonomy_chk CHECK (
    (section = 'profile'          AND fact_key IN ('name','headline','summary','narrative-theme')) OR
    (section = 'preferences'      AND fact_key IN ('remote-mode','company-stage','role-type','culture','industry')) OR
    (section = 'job_search_goals' AND fact_key IN ('target-roles','target-geos','seniority-aim','timeline')) OR
    (section = 'constraints'      AND fact_key IN ('salary-floor','locations-excluded','companies-to-avoid','visa-status','availability')) OR
    (section = 'skills') OR
    (section = 'experience'       AND (fact_key LIKE 'position:%' OR fact_key LIKE 'education:%')) OR
    (section = 'assistant_notes'  AND fact_key LIKE 'note:%')
  )
);

CREATE INDEX IF NOT EXISTS candidate_facts_user_section_idx
  ON candidate_facts (user_id, section);

-- ── candidate_fact_evidence ────────────────────────────────────────────────
-- Current-value provenance trail; one row per signal supporting the fact's
-- CURRENT value. It is append-only WHILE the value is stable; when the value
-- changes, cm__apply_fact_internal clears the now-stale rows (so old evidence
-- cannot corroborate the new value). The composite FK makes a cross-user
-- evidence row impossible; (fact_id, dedupe_key) UNIQUE makes evidence inserts
-- idempotent so a re-run import does not pile up duplicate evidence.
CREATE TABLE IF NOT EXISTS candidate_fact_evidence (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id     uuid        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source      text        NOT NULL,
  source_ref  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  excerpt     text,
  dedupe_key  text        NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_fact_evidence_fact_fk
    FOREIGN KEY (fact_id, user_id)
    REFERENCES candidate_facts (id, user_id) ON DELETE CASCADE,
  CONSTRAINT candidate_fact_evidence_dedupe_uq UNIQUE (fact_id, dedupe_key),
  CONSTRAINT candidate_fact_evidence_source_chk CHECK (source IN
    ('linkedin_onboarding','cv_upload','chat','manual','system')),
  -- Bound the provenance payload — no unbounded blobs via the RPCs.
  CONSTRAINT candidate_fact_evidence_ref_chk
    CHECK (jsonb_typeof(source_ref) = 'object'
           AND octet_length(source_ref::text) <= 2048),
  CONSTRAINT candidate_fact_evidence_excerpt_chk
    CHECK (char_length(coalesce(excerpt,'')) <= 1000),
  CONSTRAINT candidate_fact_evidence_dedupe_len_chk
    CHECK (char_length(dedupe_key) BETWEEN 1 AND 255)
);

CREATE INDEX IF NOT EXISTS candidate_fact_evidence_fact_idx
  ON candidate_fact_evidence (fact_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS candidate_fact_evidence_user_idx
  ON candidate_fact_evidence (user_id, created_at DESC);   -- export path

-- ── candidate_fact_suggestions ─────────────────────────────────────────────
-- The staged-suggestion review queue. Chat-derived facts and import conflicts
-- land here; they NEVER write candidate_facts until the user resolves them.
CREATE TABLE IF NOT EXISTS candidate_fact_suggestions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section             text        NOT NULL,
  fact_key            text        NOT NULL,
  fact_value          jsonb       NOT NULL,
  label               text        NOT NULL,
  proposed_confidence text        NOT NULL DEFAULT 'stated',
  operation           text        NOT NULL DEFAULT 'create',
  target_fact_id      uuid,
  source              text        NOT NULL DEFAULT 'chat',
  source_ref          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  excerpt             text,
  rationale           text,
  status              text        NOT NULL DEFAULT 'pending',
  resolved_value      jsonb,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Composite FK: a suggestion can only target the caller's own fact.
  -- MATCH SIMPLE — with target_fact_id NULL the FK is not enforced (a 'create'
  -- suggestion has no target); when set, same-user is enforced.
  CONSTRAINT candidate_fact_suggestions_target_fk
    FOREIGN KEY (target_fact_id, user_id)
    REFERENCES candidate_facts (id, user_id) ON DELETE CASCADE,
  CONSTRAINT candidate_fact_suggestions_section_chk CHECK (section IN
    ('profile','experience','skills','preferences',
     'job_search_goals','constraints','assistant_notes')),
  CONSTRAINT candidate_fact_suggestions_confidence_chk CHECK (proposed_confidence IN
    ('stated','inferred','corroborated')),
  CONSTRAINT candidate_fact_suggestions_operation_chk CHECK (operation IN
    ('create','update')),
  -- operation and target_fact_id must agree: create ⇔ no target.
  CONSTRAINT candidate_fact_suggestions_op_target_chk
    CHECK ((operation = 'create') = (target_fact_id IS NULL)),
  CONSTRAINT candidate_fact_suggestions_status_chk CHECK (status IN
    ('pending','accepted','rejected','edited_accepted')),
  CONSTRAINT candidate_fact_suggestions_source_chk CHECK (source IN
    ('chat','cv_upload','linkedin_onboarding')),   -- chat staging + import conflicts
  CONSTRAINT candidate_fact_suggestions_key_chk
    CHECK (fact_key ~ '^[a-z0-9][a-z0-9:_-]{0,254}$'),
  CONSTRAINT candidate_fact_suggestions_label_chk
    CHECK (char_length(label) BETWEEN 1 AND 200),
  CONSTRAINT candidate_fact_suggestions_value_chk
    CHECK (jsonb_typeof(fact_value) = 'object'),
  CONSTRAINT candidate_fact_suggestions_value_size_chk
    CHECK (octet_length(fact_value::text) <= 4096),
  CONSTRAINT candidate_fact_suggestions_ref_chk
    CHECK (jsonb_typeof(source_ref) = 'object'
           AND octet_length(source_ref::text) <= 2048),
  CONSTRAINT candidate_fact_suggestions_excerpt_chk
    CHECK (char_length(coalesce(excerpt,'')) <= 1000),
  CONSTRAINT candidate_fact_suggestions_rationale_chk
    CHECK (char_length(coalesce(rationale,'')) <= 1000),
  CONSTRAINT candidate_fact_suggestions_taxonomy_chk CHECK (
    (section = 'profile'          AND fact_key IN ('name','headline','summary','narrative-theme')) OR
    (section = 'preferences'      AND fact_key IN ('remote-mode','company-stage','role-type','culture','industry')) OR
    (section = 'job_search_goals' AND fact_key IN ('target-roles','target-geos','seniority-aim','timeline')) OR
    (section = 'constraints'      AND fact_key IN ('salary-floor','locations-excluded','companies-to-avoid','visa-status','availability')) OR
    (section = 'skills') OR
    (section = 'experience'       AND (fact_key LIKE 'position:%' OR fact_key LIKE 'education:%')) OR
    (section = 'assistant_notes'  AND fact_key LIKE 'note:%')
  )
);

-- At most one PENDING suggestion per (user, section, fact_key).
CREATE UNIQUE INDEX IF NOT EXISTS candidate_fact_suggestions_pending_uq
  ON candidate_fact_suggestions (user_id, section, fact_key)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS candidate_fact_suggestions_inbox_idx
  ON candidate_fact_suggestions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS candidate_fact_suggestions_target_idx
  ON candidate_fact_suggestions (target_fact_id);

-- ── candidate_fact_tombstones ──────────────────────────────────────────────
-- A deleted-fact marker. On delete the fact row is hard-deleted (no value
-- retained — honours erasure) and a key-only tombstone is recorded so a later
-- re-import does not silently resurrect it. A manual re-add clears it.
CREATE TABLE IF NOT EXISTS candidate_fact_tombstones (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section    text        NOT NULL,
  fact_key   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section, fact_key),
  CONSTRAINT candidate_fact_tombstones_section_chk CHECK (section IN
    ('profile','experience','skills','preferences',
     'job_search_goals','constraints','assistant_notes')),
  CONSTRAINT candidate_fact_tombstones_key_chk
    CHECK (fact_key ~ '^[a-z0-9][a-z0-9:_-]{0,254}$')
);

DROP TRIGGER IF EXISTS trg_candidate_facts_updated_at ON candidate_facts;
CREATE TRIGGER trg_candidate_facts_updated_at
  BEFORE UPDATE ON candidate_facts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

`COMMENT ON TABLE`/`COMMENT ON COLUMN` statements (house style per 0012/0013/0023) are
part of the real migration; abbreviated here only for readability.

### 2.2 Row-level security and grants

RLS gives **read-only** access to the owner; there is **no write policy** and **no write
grant**. The only writers are the `SECURITY DEFINER` functions in §2.5.

```sql
ALTER TABLE candidate_facts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_fact_evidence    ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_fact_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_fact_tombstones  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS candidate_facts_select_own ON candidate_facts;
CREATE POLICY candidate_facts_select_own ON candidate_facts
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS candidate_fact_evidence_select_own ON candidate_fact_evidence;
CREATE POLICY candidate_fact_evidence_select_own ON candidate_fact_evidence
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS candidate_fact_suggestions_select_own ON candidate_fact_suggestions;
CREATE POLICY candidate_fact_suggestions_select_own ON candidate_fact_suggestions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS candidate_fact_tombstones_select_own ON candidate_fact_tombstones;
CREATE POLICY candidate_fact_tombstones_select_own ON candidate_fact_tombstones
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy → RLS denies every direct write. Belt-and-
-- braces: revoke table-level write privileges too.
REVOKE INSERT, UPDATE, DELETE ON candidate_facts            FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON candidate_fact_evidence    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON candidate_fact_suggestions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON candidate_fact_tombstones  FROM anon, authenticated;
GRANT  SELECT ON candidate_facts            TO authenticated;
GRANT  SELECT ON candidate_fact_evidence    TO authenticated;
GRANT  SELECT ON candidate_fact_suggestions TO authenticated;
GRANT  SELECT ON candidate_fact_tombstones  TO authenticated;
```

### 2.3 Why no `enforce_user_id_is_caller()` trigger

Migration 0015's `BEFORE INSERT` trigger protects tables clients insert into directly.
Candidate Memory has **no direct client INSERT path**: the only inserters are the
`SECURITY DEFINER` functions, each of which sets `user_id := auth.uid()` itself and never
takes a `user_id` parameter. The trigger would be dead code, so it is omitted.

### 2.4 `cm_slug()` — the slug helper

```sql
CREATE OR REPLACE FUNCTION cm_slug(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from
         regexp_replace(lower(coalesce(p_text,'')), '[^a-z0-9]+', '-', 'g'));
$$;
```

Used by the backfill (§10) to derive dynamic `fact_key`s. The TypeScript extractors use
an identical slug function in `_shared/candidate-memory.ts`; both must produce the same
output for the same input (a shared test asserts parity).

### 2.5 Write-path functions

One **private worker** (`cm__apply_fact_internal`) does the real upsert work; seven
**public wrappers** are the only client-callable surface. All are `SECURITY DEFINER`
with `SET search_path = public, pg_temp`. Each resolves the caller with `auth.uid()`,
raises if NULL, and confines every statement to that uid. They are defined inside the
same `BEGIN; … COMMIT;` as the tables.

Grants (after the definitions):

```sql
-- The worker is NOT client-callable — only the wrappers (running as their
-- definer) may call it. This is what enforces "chat never writes a fact":
-- the public cm_apply_fact hard-codes source='manual', cm_apply_facts rejects
-- 'chat', and only cm_accept_suggestion may apply a fact with a chat origin.
REVOKE ALL ON FUNCTION cm__apply_fact_internal(
  text,text,jsonb,text,text,text,boolean,jsonb,text,text) FROM PUBLIC;

REVOKE ALL ON FUNCTION
  cm_apply_fact(text,text,jsonb,text,jsonb,text),
  cm_apply_facts(jsonb,text), cm_stage_suggestions(jsonb),
  cm_accept_suggestion(uuid,jsonb), cm_reject_suggestion(uuid),
  cm_delete_fact(text,text), cm_erase_memory()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  cm_apply_fact(text,text,jsonb,text,jsonb,text),
  cm_apply_facts(jsonb,text), cm_stage_suggestions(jsonb),
  cm_accept_suggestion(uuid,jsonb), cm_reject_suggestion(uuid),
  cm_delete_fact(text,text), cm_erase_memory()
  TO authenticated;
```

#### `cm__apply_fact_internal(...) → jsonb` — private worker

Returns `{fact_id, action}`, `action ∈ {inserted, updated, corroborated,
conflict_staged, skipped_tombstoned}`.

```sql
CREATE OR REPLACE FUNCTION cm__apply_fact_internal(
  p_section       text,
  p_fact_key      text,
  p_fact_value    jsonb,
  p_label         text,
  p_source        text,     -- 'manual'|'cv_upload'|'linkedin_onboarding'|'chat'|'system'
  p_confidence    text,     -- 'inferred' for imports; 'stated' for user-driven writes
  p_user_verified boolean,  -- true for manual edits and accepted suggestions
  p_source_ref    jsonb,
  p_excerpt       text,
  p_dedupe_key    text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid    := auth.uid();
  v_driven boolean := (p_user_verified OR p_source = 'manual');  -- user-initiated write
  v_fact   candidate_facts%ROWTYPE;
  v_fid    uuid;
  v_action text;
  v_dedupe text := COALESCE(p_dedupe_key,
                            p_source || ':' || md5(coalesce(p_excerpt,'') || p_source_ref::text));
  v_evcnt  integer;
  v_nsrc   integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  IF p_section NOT IN ('profile','experience','skills','preferences',
                       'job_search_goals','constraints','assistant_notes') THEN
    RAISE EXCEPTION 'candidate memory: invalid section %', p_section;
  END IF;
  IF p_fact_key !~ '^[a-z0-9][a-z0-9:_-]{0,254}$' THEN
    RAISE EXCEPTION 'candidate memory: invalid fact_key %', p_fact_key;
  END IF;

  -- Tombstone: a non-user-driven import respects it; a user-driven write clears it.
  IF v_driven THEN
    DELETE FROM candidate_fact_tombstones
    WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key;
  ELSIF EXISTS (SELECT 1 FROM candidate_fact_tombstones
                WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key) THEN
    RETURN jsonb_build_object('fact_id', NULL, 'action', 'skipped_tombstoned');
  END IF;

  -- Lock-or-insert, race-safe.
  SELECT * INTO v_fact FROM candidate_facts
  WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                                 confidence, source, user_verified)
    VALUES (v_uid, p_section, p_fact_key, p_fact_value, p_label,
            CASE WHEN v_driven THEN 'stated' ELSE p_confidence END,
            p_source, v_driven)
    ON CONFLICT (user_id, section, fact_key) DO NOTHING
    RETURNING * INTO v_fact;

    IF FOUND THEN
      v_fid := v_fact.id;
      v_action := 'inserted';
    ELSE
      -- A concurrent writer inserted it first; re-read with the lock.
      SELECT * INTO v_fact FROM candidate_facts
      WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key
      FOR UPDATE;
    END IF;
  END IF;

  IF v_action IS NULL THEN          -- existing-fact path
    IF v_fact.fact_value = p_fact_value THEN
      -- Same value: corroboration. Still apply verify/label/source.
      UPDATE candidate_facts
        SET label = p_label, source = p_source,
            user_verified = v_fact.user_verified OR v_driven,
            confidence = CASE WHEN v_fact.user_verified OR v_driven THEN 'stated'
                              ELSE confidence END,
            last_seen = now()
      WHERE id = v_fact.id;
      v_fid := v_fact.id;
      v_action := 'corroborated';

    ELSIF (v_fact.user_verified OR v_fact.confidence = 'corroborated')
          AND NOT v_driven THEN
      -- Value differs and the existing fact is strong (verified or
      -- corroborated): an import must not silently flip it. Stage a conflict.
      INSERT INTO candidate_fact_suggestions
        (user_id, section, fact_key, fact_value, label, proposed_confidence,
         operation, target_fact_id, source, source_ref, excerpt, rationale, status)
      VALUES (v_uid, p_section, p_fact_key, p_fact_value, p_label, 'stated',
              'update', v_fact.id, p_source, p_source_ref, p_excerpt,
              format('A value from %s conflicts with an existing %s fact.',
                     p_source, CASE WHEN v_fact.user_verified THEN 'verified'
                                    ELSE 'corroborated' END),
              'pending')
      ON CONFLICT (user_id, section, fact_key) WHERE status = 'pending'
        DO UPDATE SET fact_value = EXCLUDED.fact_value, label = EXCLUDED.label,
                      proposed_confidence = EXCLUDED.proposed_confidence,
                      operation = EXCLUDED.operation,
                      target_fact_id = EXCLUDED.target_fact_id,
                      source = EXCLUDED.source, source_ref = EXCLUDED.source_ref,
                      excerpt = EXCLUDED.excerpt, rationale = EXCLUDED.rationale,
                      created_at = now();
      RETURN jsonb_build_object('fact_id', v_fact.id, 'action', 'conflict_staged');

    ELSE
      -- Value differs and overwrite is allowed (manual edit, or a weak fact).
      -- Evidence for the OLD value is now stale — drop it so it cannot
      -- corroborate the new value.
      DELETE FROM candidate_fact_evidence WHERE fact_id = v_fact.id;
      UPDATE candidate_facts
        SET fact_value = p_fact_value, label = p_label, source = p_source,
            confidence = CASE WHEN v_driven THEN 'stated' ELSE p_confidence END,
            user_verified = v_fact.user_verified OR v_driven,
            last_seen = now()
      WHERE id = v_fact.id;
      v_fid := v_fact.id;
      v_action := 'updated';
    END IF;
  END IF;

  -- Append evidence (idempotent on (fact_id, dedupe_key)).
  INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, excerpt, dedupe_key)
  VALUES (v_fid, v_uid, p_source, p_source_ref, p_excerpt, v_dedupe)
  ON CONFLICT (fact_id, dedupe_key) DO NOTHING;

  -- Recompute counts + confidence. evidence_count = number of evidence rows;
  -- corroboration uses DISTINCT source. A user-verified fact is always 'stated'.
  SELECT count(*), count(DISTINCT source) INTO v_evcnt, v_nsrc
  FROM candidate_fact_evidence WHERE fact_id = v_fid;

  UPDATE candidate_facts
    SET evidence_count = GREATEST(v_evcnt, 1),
        confidence = CASE
          WHEN user_verified            THEN 'stated'
          WHEN confidence = 'stated'    THEN 'stated'
          WHEN v_nsrc >= 2              THEN 'corroborated'
          ELSE confidence END,
        last_seen = now()
  WHERE id = v_fid;

  RETURN jsonb_build_object('fact_id', v_fid, 'action', v_action);
END $$;
```

#### `cm_apply_fact(...) → jsonb` — manual single write (the only client fact-write)

```sql
CREATE OR REPLACE FUNCTION cm_apply_fact(
  p_section    text,
  p_fact_key   text,
  p_fact_value jsonb,
  p_label      text,
  p_source_ref jsonb DEFAULT '{}'::jsonb,
  p_excerpt    text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  -- source is hard-coded 'manual': a client can only ever write its own
  -- manual edits. Imports use cm_apply_facts; chat uses cm_stage_suggestions.
  SELECT cm__apply_fact_internal(p_section, p_fact_key, p_fact_value, p_label,
           'manual', 'stated', true, p_source_ref, p_excerpt, 'manual');
$$;
```

Used by the Buddy's Brain UI for adding a fact, editing a value, and the "verify" /
"mark all reviewed" actions (verifying = applying the *current* value with
`source='manual'`, which routes through the same-value `corroborated` branch and sets
`user_verified`). The constant `dedupe_key='manual'` keeps a single manual-evidence row
per fact.

#### `cm_apply_facts(p_facts jsonb, p_source text) → jsonb` — atomic batch import

```sql
CREATE OR REPLACE FUNCTION cm_apply_facts(p_facts jsonb, p_source text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_out  jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  IF p_source NOT IN ('cv_upload','linkedin_onboarding') THEN
    RAISE EXCEPTION 'cm_apply_facts: source must be an import source, got %', p_source;
  END IF;
  IF p_facts IS NULL OR jsonb_typeof(p_facts) <> 'array' THEN
    RAISE EXCEPTION 'cm_apply_facts: p_facts must be a JSON array';
  END IF;
  IF jsonb_array_length(p_facts) > 100 THEN
    RAISE EXCEPTION 'cm_apply_facts: batch too large (% > 100)', jsonb_array_length(p_facts);
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_facts) LOOP
    v_out := v_out || cm__apply_fact_internal(
      v_item->>'section', v_item->>'fact_key', v_item->'fact_value',
      v_item->>'label', p_source, 'inferred', false,
      COALESCE(v_item->'source_ref', '{}'::jsonb), v_item->>'excerpt',
      v_item->>'dedupe_key');   -- caller passes a deterministic dedupe_key
  END LOOP;
  RETURN v_out;   -- array of {fact_id, action}
END $$;
```

One transaction (the function call) — any raised error rolls the whole import back.
Imports are always `inferred` + unverified. A fact conflicting with a verified or
corroborated fact returns `conflict_staged`; a tombstoned key returns
`skipped_tombstoned`. Callers pass a deterministic `dedupe_key` per fact (e.g.
`cv_upload:<filename>:<fact_key>`) so re-running the same import does not pile up
evidence.

#### `cm_stage_suggestions(p_suggestions jsonb) → jsonb` — chat staging

```sql
CREATE OR REPLACE FUNCTION cm_stage_suggestions(p_suggestions jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_item   jsonb;
  v_target uuid;
  v_op     text;
  v_row    candidate_fact_suggestions%ROWTYPE;
  v_out    jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  IF p_suggestions IS NULL OR jsonb_typeof(p_suggestions) <> 'array' THEN
    RAISE EXCEPTION 'cm_stage_suggestions: p_suggestions must be a JSON array';
  END IF;
  IF jsonb_array_length(p_suggestions) > 100 THEN
    RAISE EXCEPTION 'cm_stage_suggestions: batch too large (% > 100)',
                    jsonb_array_length(p_suggestions);
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_suggestions) LOOP
    -- Validate every DB-enforced field and CONTINUE (skip) a malformed item so
    -- one bad suggestion cannot abort the whole batch with a CHECK violation.
    CONTINUE WHEN (v_item->>'section') NOT IN ('profile','experience','skills',
       'preferences','job_search_goals','constraints','assistant_notes');
    CONTINUE WHEN COALESCE(v_item->>'fact_key','') !~ '^[a-z0-9][a-z0-9:_-]{0,254}$';
    CONTINUE WHEN char_length(COALESCE(v_item->>'label','')) NOT BETWEEN 1 AND 200;
    CONTINUE WHEN jsonb_typeof(v_item->'fact_value') IS DISTINCT FROM 'object';
    CONTINUE WHEN octet_length((v_item->'fact_value')::text) > 4096;
    CONTINUE WHEN char_length(coalesce(v_item->>'excerpt','')) > 1000;
    CONTINUE WHEN char_length(coalesce(v_item->>'rationale','')) > 1000;
    CONTINUE WHEN jsonb_typeof(COALESCE(v_item->'source_ref','{}'::jsonb))
                  IS DISTINCT FROM 'object'
               OR octet_length(COALESCE(v_item->'source_ref','{}'::jsonb)::text) > 2048;
    -- Taxonomy: fixed-key sections must use an allowed key (mirrors the CHECK).
    CONTINUE WHEN NOT (
      (v_item->>'section' = 'profile'          AND v_item->>'fact_key' IN ('name','headline','summary','narrative-theme')) OR
      (v_item->>'section' = 'preferences'      AND v_item->>'fact_key' IN ('remote-mode','company-stage','role-type','culture','industry')) OR
      (v_item->>'section' = 'job_search_goals' AND v_item->>'fact_key' IN ('target-roles','target-geos','seniority-aim','timeline')) OR
      (v_item->>'section' = 'constraints'      AND v_item->>'fact_key' IN ('salary-floor','locations-excluded','companies-to-avoid','visa-status','availability')) OR
      (v_item->>'section' = 'skills') OR
      (v_item->>'section' = 'experience'       AND (v_item->>'fact_key' LIKE 'position:%' OR v_item->>'fact_key' LIKE 'education:%')) OR
      (v_item->>'section' = 'assistant_notes'  AND v_item->>'fact_key' LIKE 'note:%'));

    -- FOR KEY SHARE pins the target fact against a concurrent delete between
    -- this lookup and the INSERT (otherwise the composite FK could fail).
    SELECT id INTO v_target FROM candidate_facts
    WHERE user_id = v_uid AND section = v_item->>'section'
      AND fact_key = v_item->>'fact_key'
    FOR KEY SHARE;
    v_op := CASE WHEN v_target IS NULL THEN 'create' ELSE 'update' END;

    INSERT INTO candidate_fact_suggestions
      (user_id, section, fact_key, fact_value, label, proposed_confidence,
       operation, target_fact_id, source, source_ref, excerpt, rationale, status)
    VALUES (v_uid, v_item->>'section', v_item->>'fact_key', v_item->'fact_value',
            v_item->>'label', 'stated', v_op, v_target, 'chat',
            COALESCE(v_item->'source_ref', '{}'::jsonb),
            v_item->>'excerpt', v_item->>'rationale', 'pending')
    ON CONFLICT (user_id, section, fact_key) WHERE status = 'pending'
      DO UPDATE SET fact_value = EXCLUDED.fact_value, label = EXCLUDED.label,
                    proposed_confidence = EXCLUDED.proposed_confidence,
                    operation = EXCLUDED.operation,
                    target_fact_id = EXCLUDED.target_fact_id,
                    source = EXCLUDED.source, source_ref = EXCLUDED.source_ref,
                    excerpt = EXCLUDED.excerpt, rationale = EXCLUDED.rationale,
                    created_at = now()
    RETURNING * INTO v_row;
    v_out := v_out || to_jsonb(v_row);
  END LOOP;
  RETURN v_out;   -- array of the staged suggestion rows
END $$;
```

#### `cm_accept_suggestion(p_suggestion_id uuid, p_resolved_value jsonb DEFAULT NULL) → jsonb`

Deadlock-safe: it does **not** lock the suggestion before applying the fact. Both this
function and an import lock the **fact** first (`cm__apply_fact_internal`'s
`SELECT … FOR UPDATE` / `ON CONFLICT`), then the suggestion — a consistent lock order.

```sql
CREATE OR REPLACE FUNCTION cm_accept_suggestion(
  p_suggestion_id  uuid,
  p_resolved_value jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_s   candidate_fact_suggestions%ROWTYPE;
  v_val jsonb;
  v_res jsonb;
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  SELECT * INTO v_s FROM candidate_fact_suggestions
  WHERE id = p_suggestion_id AND user_id = v_uid;   -- no FOR UPDATE (lock order)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cm_accept_suggestion: suggestion not found';
  END IF;
  IF v_s.status <> 'pending' THEN
    RAISE EXCEPTION 'cm_accept_suggestion: suggestion already %', v_s.status;
  END IF;

  v_val := COALESCE(p_resolved_value, v_s.fact_value);

  -- Apply as a user-verified fact, but PRESERVE the true origin source in the
  -- evidence trail (v_s.source = 'chat' / 'cv_upload' / 'linkedin_onboarding').
  -- On an EDITED accept the original excerpt no longer describes the stored
  -- value, so the evidence excerpt is dropped (the value is the user's edit).
  v_res := cm__apply_fact_internal(
    v_s.section, v_s.fact_key, v_val, v_s.label,
    v_s.source, 'stated', true,
    v_s.source_ref,
    CASE WHEN p_resolved_value IS NULL THEN v_s.excerpt ELSE NULL END,
    'suggestion:' || v_s.id::text);

  -- Resolve the suggestion; the WHERE status='pending' guard means a
  -- concurrent accept that already resolved it makes this match 0 rows,
  -- and the RAISE rolls back the fact apply above.
  UPDATE candidate_fact_suggestions
    SET status = CASE WHEN p_resolved_value IS NULL THEN 'accepted'
                      ELSE 'edited_accepted' END,
        resolved_value = v_val, resolved_at = now()
  WHERE id = v_s.id AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'cm_accept_suggestion: suggestion was resolved concurrently';
  END IF;

  RETURN v_res;   -- {fact_id, action}
END $$;
```

#### `cm_reject_suggestion(p_suggestion_id uuid) → void`

```sql
CREATE OR REPLACE FUNCTION cm_reject_suggestion(p_suggestion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  UPDATE candidate_fact_suggestions SET status = 'rejected'
  WHERE id = p_suggestion_id AND user_id = auth.uid() AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'cm_reject_suggestion: no pending suggestion with that id';
  END IF;
END $$;
```

#### `cm_delete_fact(p_section text, p_fact_key text) → void`

```sql
CREATE OR REPLACE FUNCTION cm_delete_fact(p_section text, p_fact_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  -- Lock order: delete the FACT first (same fact-then-suggestion order as
  -- every other write path — no deadlock against accept/import/stage).
  -- Evidence + 'update'-type suggestions cascade via the composite FK.
  DELETE FROM candidate_facts
  WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key;
  -- Then delete EVERY remaining suggestion for the key — all statuses, not
  -- just pending. An accepted/rejected 'create' suggestion has target_fact_id
  -- NULL so it does not cascade, and it still holds the deleted fact_value;
  -- leaving it would violate per-fact erasure. No value is retained anywhere.
  DELETE FROM candidate_fact_suggestions
  WHERE user_id = v_uid AND section = p_section AND fact_key = p_fact_key;
  -- Record a key-only tombstone so a later import does not resurrect it.
  INSERT INTO candidate_fact_tombstones (user_id, section, fact_key)
  VALUES (v_uid, p_section, p_fact_key)
  ON CONFLICT DO NOTHING;
END $$;
```

#### `cm_erase_memory() → integer`

```sql
CREATE OR REPLACE FUNCTION cm_erase_memory()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'candidate memory: no authenticated user';
  END IF;
  DELETE FROM candidate_fact_suggestions WHERE user_id = v_uid;
  WITH d AS (DELETE FROM candidate_facts WHERE user_id = v_uid RETURNING 1)
    SELECT count(*) INTO v_n FROM d;          -- evidence cascades
  DELETE FROM candidate_fact_tombstones WHERE user_id = v_uid;
  RETURN v_n;   -- number of facts erased
END $$;
```

GDPR Art. 17 full erasure of the Candidate Memory tables. It does **not** touch the
`applications` table — `application_history` is operational tracker data, deleted from
the applications page, not memory (see §9).

---

## 3. Fact taxonomy

To prevent the "free-form mini-blob" and "facts that never deduplicate" failure modes,
`fact_key` follows a fixed taxonomy and `fact_value` follows a per-section shape, enforced
at **two layers**:

- **DB boundary (§2.1).** `candidate_facts` and `candidate_fact_suggestions` carry a
  `*_taxonomy_chk` CHECK that enumerates the allowed `fact_key`s for every fixed-key
  section and pattern-matches the dynamic-key sections, plus structural bounds
  (`fact_key` pattern/length, `label` length, `fact_value` is a JSON object ≤ 4 KB).
  A client crafting raw RPC calls therefore cannot store an off-taxonomy key or an
  oversized blob — even in its own memory.
- **TS validate (§4.3).** `_shared/candidate-memory.ts` carries the same key set plus
  the per-section `fact_value` *shapes* as a typed constant `FACT_TAXONOMY`, applied
  before any RPC call. This is the layer the extractors and the backfill map onto, and
  it catches shape errors the SQL CHECK does not (e.g. a `skills` fact missing `name`).

The two layers must agree; a shared test asserts the SQL key set and `FACT_TAXONOMY`
list the same keys.

**Sections with a fixed key set** — extractors map onto these keys, never invent:

| Section | Allowed `fact_key`s | `fact_value` shape |
|---|---|---|
| `profile` | `name`, `headline`, `summary`, `narrative-theme` | `{ "text": string }` |
| `preferences` | `remote-mode`, `company-stage`, `role-type`, `culture`, `industry` | `{ "value": string, "note"?: string }` |
| `job_search_goals` | `target-roles`, `target-geos`, `seniority-aim`, `timeline` | `{ "values": string[] }` or `{ "text": string }` |
| `constraints` | `salary-floor`, `locations-excluded`, `companies-to-avoid`, `visa-status`, `availability` | `{ "value": string\|number, "values"?: string[] }` |

**Sections with dynamic keys** — one fact per real-world entity; the key is a
`cm_slug()` of the entity name so the same entity from two sources collides and
deduplicates:

| Section | `fact_key` rule | `fact_value` shape |
|---|---|---|
| `skills` | `cm_slug(skill_name)` (e.g. `financial-modelling`) | required `name`; optional `level`, `years` |
| `experience` (position) | `position:cm_slug(company)-cm_slug(role)` | required `company`; optional `role`, `start`, `end`, `summary` |
| `experience` (education) | `education:cm_slug(institution)` | required `institution`; optional `degree`, `start`, `end` |
| `assistant_notes` | `note:cm_slug(short-topic)` | required `text` |

Only the **identifying** field is required (`name` for a skill, `company` for a
position, `institution` for education, `text` for a note) — legacy `user_profile` rows
and real CVs routinely omit dates or roles, so every other field is optional. The
validate stage drops any extracted fact whose `(section, fact_key)` violates the
taxonomy (unknown key in a fixed-key section, malformed dynamic key, or a `fact_value`
missing its one required field) but accepts a fact that omits optional fields.

---

## 4. Synthesis pipeline

Four stages — ingest → extract → validate → write/stage.

### 4.1 Stage 1 — Ingest (per source)

| Source | Trigger | Route |
|---|---|---|
| `manual` | User edits/adds/verifies a fact in Buddy's Brain | `cm_apply_fact`, `stated` + verified |
| `linkedin_onboarding` | LinkedIn-URL onboarding completes | import → `cm_apply_facts`, `inferred`, unverified |
| `cv_upload` | `analyze-cv` finishes a CV analysis | import → `cm_apply_facts`, `inferred`, unverified |
| `chat` | A Buddy chat turn | staged → `cm_stage_suggestions` — never a direct fact write |
| `system` | One-time backfill (§10) | direct insert by the migration, `inferred`, unverified |

### 4.2 Stage 2 — Extract

- **Imports** (`linkedin_onboarding`, `cv_upload`). The onboarding / CV-analysis LLM call
  already returns structured output (`analyze-cv` has a `RESPONSE_SCHEMA` today). Pure
  mapper functions in `_shared/candidate-memory.ts` (`factsFromCvAnalysis`,
  `factsFromLinkedinProfile`) convert that output into a typed `ExtractedFact[]` mapped
  onto the §3 taxonomy. **No extra LLM call.**
- **Chat.** Extraction happens **inside the single existing chat `generateContent`
  call** — no second call, no extra quota (the Gemini free-tier daily quota binds). The
  chat system prompt instructs Buddy to, *after* its conversational reply, append a
  fenced block, and only when the user has stated a durable, profile-worthy fact:

  ````
  ```memory-suggestions
  [{ "section": "...", "fact_key": "...", "fact_value": {...}, "label": "...",
     "excerpt": "...", "rationale": "..." }]
  ```
  ````

  Hardening against prompt injection / accidental code blocks: the chat edge function
  takes the **last** ```` ```memory-suggestions ```` fenced block in the reply (if the
  model emits several, the last wins); validates every item against the §3 taxonomy;
  caps each string field (`label`, `excerpt`, `rationale` ≤ 500 chars; `fact_value`
  serialised ≤ 2 KB). **Any syntactically detected `memory-suggestions` fence is
  stripped from the reply text** — whether or not its JSON parses — so the user never
  sees a raw block. If the JSON does not parse, the result is simply no suggestions
  (`suggestions: []`); the cleaned reply is still returned (fail-open).

> Function-calling / structured tool output is the intended v1.1 upgrade for chat
> extraction (§13). The fenced-block approach is v1 because it is one call (quota-safe)
> and deterministic to parse.

### 4.3 Stage 3 — Validate (deterministic, server-side, pure)

`validateExtractedFacts(facts)` in `_shared/candidate-memory.ts` — pure, no LLM, no
network. Runs before any RPC call:

1. **Taxonomy** — drop any fact whose `section` is not one of the seven, whose
   `(section, fact_key)` violates §3, or whose `fact_value` is missing a required field.
2. **Slug-normalise** dynamic `fact_key`s with the shared slug function (parity with
   `cm_slug()`); drop any fact whose final `fact_key` exceeds 254 chars or fails the
   `^[a-z0-9][a-z0-9:_-]{0,254}$` pattern (matches the DB CHECK).
3. **String caps** — truncate `label`/`excerpt`/`rationale`; reject `fact_value`
   serialising over 2 KB.
4. **Cap** — at most 40 facts per section per ingest; log overflow.
5. **Dedup within the batch** — collapse repeated `(section, fact_key)` to the last.

Validate rejects malformed input only. It does **not** decide "is this a real fact" for
chat — that is the user's job at the approval gate (§5.3).

### 4.4 Stage 4 — Write or Stage

- **Imports** → `cm_apply_facts(batch, source)`. The caller logs the per-fact `action`
  array (`inserted` / `updated` / `corroborated` / `conflict_staged` /
  `skipped_tombstoned`) for observability.
- **Chat** → `cm_stage_suggestions(batch)`. Returns the staged rows; the chat edge
  function passes them back to the client (§7.2).

---

## 5. Evidence & confidence model

### 5.1 Confidence — a three-value enum, not a score

| Value | Meaning | Set by |
|---|---|---|
| `stated` | The user said it directly | manual edit; accepted suggestion |
| `inferred` | LLM-extracted from one source | a single import |
| `corroborated` | `inferred`, then confirmed by a second independent source | `cm__apply_fact_internal` |

A numeric 0–1 score is rejected: an LLM cannot calibrate it, and the product promise is
a memory the user can *read and trust*, not a probability to interpret. The column is
`text` + CHECK (matching every existing status/source column in the repo); §6.2 handles
trust-ordering explicitly so textual storage never drives sort order.

### 5.2 `user_verified` is orthogonal and wins

`user_verified` is a separate boolean. A fact the user confirmed (verified in the UI, or
accepted as a suggestion) is `user_verified = true`, and its `confidence` is forced to
`stated`. An import that contradicts a verified **or corroborated** fact is staged as a
suggestion, never written (§2.5); a manual edit always overwrites. User ground truth
always wins.

### 5.3 The evidence threshold

- **Chat signals** never become a fact without crossing the **user-approval gate** —
  the staged-suggestion queue *is* the threshold. One chat message can never silently
  become a profile fact.
- **Import signals** become an `inferred` fact immediately (the user actively triggered
  the import) but reach `corroborated` only once a **second independent source** agrees
  — the `count(DISTINCT source) >= 2` rule in `cm__apply_fact_internal`.

"Independent source" in v1 = a different `source` enum value. Re-running the *same*
source does not double-count: the `(fact_id, dedupe_key)` unique constraint makes the
repeated evidence insert a no-op. When a fact's value changes, evidence for the old
value is deleted, so corroboration always reflects the **current** value. A stricter
notion of independence (genuinely independent vs. copied underlying content) is a known
limitation, recorded in §13.

**Provenance is honest about reach.** `source` records the *claimed* ingest origin. The
write RPCs are granted to `authenticated`, so a user could in principle call
`cm_stage_suggestions` (staging a `chat`-labelled suggestion no chat turn produced) or
`cm_apply_facts` (writing a `cv_upload`-labelled fact with no CV) directly against their
**own** memory. This is an **accepted non-threat, explicitly not a gap**: it mislabels
only the caller's own data (no cross-tenant impact, no other user affected), and is
strictly weaker than just calling `cm_apply_fact` to add the fact outright — a user has
always been free to put anything in their own memory. The guarantees the design *does*
enforce are the ones that matter: cross-user isolation (RLS + composite FKs), the
distinction between an unverified claim and a verified fact, the chat-staging gate as a
*UX* contract for the real chat flow, and the structural/taxonomy/size bounds. Provenance
is a transparency feature for the data's owner, not a security boundary against them.
Treating it as the latter would require routing imports through a service-role edge path
with a caller-supplied `user_id` — re-opening exactly the cross-tenant surface this
design closes. The trade is deliberate.

`candidate_fact_evidence` is the authoritative provenance the UI renders — append-only
while a value is stable, reset when the value changes. `candidate_facts.source` is a
denormalised convenience (the source of the *most recent* write — the UI labels it
"last seen from", and shows "verified by you" instead on a `user_verified` fact, so a
later corroborating import cannot make the badge misrepresent a verified fact's origin).
Primary provenance is always the evidence trail, not this column.

---

## 6. Context Card — the read path

### 6.1 What it is

A compact, server-rendered summary of the caller's memory, injected into every
meaningful AI call. Two representations from one helper:

- `card_markdown` — a ≤ ~450-word Markdown block grouped by section, each fact annotated
  with its trust (`✓ verified` / `corroborated` / `inferred — unverified`). Unverified
  inferred facts are **kept** (still useful context) but clearly labelled so the model
  weighs them cautiously; each reader's system prompt is told to treat `inferred —
  unverified` facts as tentative.
- `card_json` — `{ section: { fact_key: { value, confidence, user_verified } } }` for
  callers that branch programmatically.

### 6.2 `_shared/context-card.ts`

New shared module. Single export:

```ts
loadContextCard(supabase: SupabaseClient, userId: string): Promise<ContextCard>
```

- One direct `SELECT` for facts (no RPC, no raw SQL — supabase-js cannot run an arbitrary
  `ORDER BY CASE`):
  ```ts
  supabase.from("candidate_facts")
    .select("section,fact_key,fact_value,label,confidence,user_verified,last_seen")
    .eq("user_id", userId);
  ```
  The RLS `SELECT`-own policy already scopes it to the caller. **Trust-ranking and the
  cap are done in TypeScript:** sort all facts by trust *globally* — `user_verified`
  first, then `confidence` (`corroborated` > `inferred`), then `last_seen` desc — then
  take the top **40 across all sections**, and only then group the kept facts by section
  for the Markdown. Because the sort is global and trust-first, eviction always removes
  the *lowest*-trust facts first: a verified fact is dropped only if the user has 40+
  facts of equal-or-higher trust (40+ verified facts) — for any realistic memory the
  card holds every verified and corroborated fact.
- One `SELECT` for the `application_history` projection:
  ```ts
  supabase.from("applications")
    .select("company,role,status,applied_date,last_event_date,next_action")
    .eq("user_id", userId)
    .order("last_event_date", { ascending: false, nullsFirst: false })
    .limit(15);
  ```
  (A 15-row result after a user-id filter — the sort is trivial; no dedicated index is
  required.)
- **Fails open with logging.** Any error (no rows, query failure) yields an empty card
  (`card_markdown = "(no candidate memory yet)"`) plus a structured `console.error`
  (`{ fn: "loadContextCard", userId, error }`) so the failure is observable and
  alertable — a reader edge function must never 500 because the memory layer hiccupped,
  but the failure must not be silent.

The memory is small (tens of facts, a few KB); v1 computes the card on read with no
cache table. §13 lists a cache table as a v1.1 option if profiling shows it matters.

### 6.3 Injection point

The card is injected into the context block of these four edge functions:

| Function | Change |
|---|---|
| `chat` | The `## CANDIDATE MEMORY` block becomes the card; the client `profile`/`applications` body fields are no longer read into the prompt |
| `analyze-cv` | Add the card to the analysis prompt (memory informs the CV review) |
| `draft-message` | Add the card to the drafting context |
| `match-job` | Add the card to the fit-scoring context |

Each function already authenticates the caller, so it has the `userId` and the caller's
`Authorization` header — it builds an RLS-scoped Supabase client exactly as
`insertRadarSnapshot` does today (`createClient(url, anonKey, { global: { headers: {
Authorization } } })`) and calls `loadContextCard`. **If the caller is unauthenticated**
(`userId === "anonymous"`, pre-auth phase) the card is empty and **no Candidate Memory
RPC is called** — the same guard `insertRadarSnapshot` uses (`if (userId ===
"anonymous") return`). Candidate Memory is an auth-era feature; pre-auth callers simply
get no memory, never an error.

**No lockstep deploy.** v1 keeps *accepting* the legacy client-supplied `profile` /
`applications` request fields (old clients keep working) but **stops injecting them into
any prompt** — the server-rendered card is the sole profile context. This removes the
stale/spoofable client-context path immediately. A later cleanup ADR drops the
now-ignored request fields and the client code that sends them.

---

## 7. Edge functions

### 7.1 New shared modules

- `supabase/functions/_shared/context-card.ts` — §6.2.
- `supabase/functions/_shared/candidate-memory.ts` — the `FACT_TAXONOMY` constant; the
  shared `slug()` (parity with `cm_slug()`); the extraction mappers
  (`factsFromCvAnalysis`, `factsFromLinkedinProfile`); `validateExtractedFacts`; the
  `memory-suggestions` fenced-block parser (`parseMemoryBlock`); thin `rpc()` wrappers.
  Pure functions are unit-tested in isolation (the repo already does this — see
  `analyze-cv/radar.test.ts`).

### 7.2 Modified — `chat`

1. Drop the client-supplied `profile`/`applications` summarisation; call
   `loadContextCard` and inject `card_markdown` as the `## CANDIDATE MEMORY` block.
2. Extend `SYSTEM_PROMPT`: the `memory-suggestions` fenced-block instruction (§4.2); an
   instruction to treat `inferred — unverified` facts as tentative; an instruction that,
   when it appends a suggestion, it phrases this to the user **as a non-committal offer,
   never as a completed action** — *"Want me to remember that you only want remote
   roles? I can add it to your review queue for you to confirm."* — because the DB
   insert happens only after the model returns, so the prose must never claim the write
   has already happened.
3. After the Gemini response: `parseMemoryBlock(reply)` strips any detected
   `memory-suggestions` fence from `reply` (§4.2) → `validateExtractedFacts` →
   `cm_stage_suggestions` RPC → return the **actually inserted** rows in a new
   `suggestions` field. The client renders the inline "Buddy noted…" card **only from
   `suggestions[]`** — that card, not the model's prose, is the authoritative
   confirmation that staging succeeded. If staging fails or the caller is `anonymous`,
   `suggestions` is `[]` and the failure (if any) is logged; the chat reply is still
   returned (fail-open).

Response shape: `{ reply: string, suggestions: StagedSuggestion[] }` — `suggestions`
defaults to `[]`, so any client that ignores it is unaffected.

### 7.3 Modified — `analyze-cv`

After producing the CV analysis (and the existing radar snapshot):
`factsFromCvAnalysis(analysis)` → `validateExtractedFacts` → `cm_apply_facts` RPC with
`source = 'cv_upload'`. **Fail-open:** if the RPC fails, log the error and still return
the CV analysis — a memory-write hiccup must never fail a successful CV analysis. The
per-fact `action` array is logged on success. Conflicts with verified/corroborated facts
become suggestions (inside the RPC); tombstoned keys are skipped. This is a write the
user triggered (they uploaded the CV) — not a silent write — and the resulting facts are
`inferred` + unverified, surfaced in the import-review state (§8).

### 7.4 Modified — `draft-message`, `match-job`

Read-only: inject the Context Card into the prompt context. No write path. Same
anonymous-caller guard as §6.3.

### 7.5 Frontend → DB (reads direct, writes via RPC)

The Buddy's Brain UI **reads** the four tables directly through the supabase-js client,
bounded by the SELECT RLS policies. Every **write** goes through an RPC —
`rpc('cm_apply_fact')` (manual add/edit/verify), `rpc('cm_accept_suggestion')`,
`rpc('cm_reject_suggestion')`, `rpc('cm_delete_fact')`, `rpc('cm_erase_memory')` —
because §2.2 grants clients no direct write privilege. No dedicated CRUD edge function
is needed.

---

## 8. Buddy's Brain — the UI

New TanStack Start route `src/routes/memory.tsx` → `/memory`, components under
`src/components/memory/`, a nav entry in `src/components/Nav.tsx`. Auth-gated like
`/profile`.

Layout, top to bottom:

1. **Suggestion inbox** — pending `candidate_fact_suggestions`, newest first. Each row:
   `label`, proposed value, `excerpt` ("what Buddy heard"), `rationale`, and three
   actions — **Accept** (`rpc('cm_accept_suggestion')`), **Edit & Accept** (inline-edit,
   then `rpc` with `p_resolved_value`), **Reject** (`rpc('cm_reject_suggestion')`).
   Empty state when none.
2. **Import-review banner** — shown when unverified import facts exist
   (`user_verified = false AND source IN ('cv_upload','linkedin_onboarding','system')`).
   "Buddy built N facts from your CV/LinkedIn — review them." Dismissal is explicit:
   verifying or deleting each fact, or a **"Mark all reviewed"** bulk action that calls
   `cm_apply_fact` (re-applying the current value as `manual` → verified) for each listed
   fact. The banner clears once no unverified import facts remain.
3. **Section panels** — one per stored section. Each fact card: `label`,
   inline-editable value, a **trust badge** (`✓ verified` / `corroborated` / `inferred`),
   a **source badge** (on a `user_verified` fact it reads "verified by you"; otherwise
   "last seen from <source>" — the badge never claims a verified fact's origin from the
   denormalised `source` column), a **provenance popover** (the full
   `candidate_fact_evidence` trail — per-row source, excerpt, `observed_at` — which is
   the authoritative provenance), a **verify** control, a **delete** control. Editing a
   value or verifying calls `rpc('cm_apply_fact')`. Delete calls `rpc('cm_delete_fact')`.
4. **`application_history` panel** — read-only projection from `applications`, with a
   link to the applications page. Not editable here (reference, not wrap).
5. **Footer actions** — **Export** (§9) and **Delete all memory** (§9).

A first-visit notice states plainly what Candidate Memory stores, that the user owns and
controls it, and links to export/delete (GDPR Art. 13/14 transparency).

Design follows the repo house rules: no emojis in UI, restrained palette, no coloured
left-borders on cards, real SVG icons. Trust/source badges are plain text or icon chips.

---

## 9. GDPR surface

| Right | Surface |
|---|---|
| Transparency (Art. 13/14) | The Buddy's Brain page: every fact visible with source + provenance trail. First-visit notice. |
| Portability (Art. 20) | **Export** button: fetch all facts + their evidence (and the `application_history` projection), render **Markdown** and **JSON**, trigger two browser downloads. Pure client-side from already-fetched RLS-scoped data. |
| Erasure (Art. 17) | **Per-fact:** `cm_delete_fact` — hard-deletes the fact + evidence, retains only a key-only tombstone (no value). **Full:** "Delete all memory" → confirm modal → `cm_erase_memory()` (facts, evidence, suggestions, tombstones). Distinct from account deletion. |
| Data minimisation | Fixed seven-section CHECK + §3 taxonomy + structural CHECKs; no free-form blob; **no email-body ingestion** (carried verbatim from icontext — if email ever becomes a source it is headers-only with explicit consent); `assistant_notes` clearly labelled as Buddy's inferences. |

**`application_history` is operational tracker data, not memory.** It is a live
projection of the `applications` table; "Delete all memory" (`cm_erase_memory`) does
**not** delete applications, and the UI/export label it explicitly as sourced from the
job-applications tracker, with deletion available on the applications page. The export
still *includes* the projection (it is injected into AI context, so portability must
cover it), clearly marked with its source table.

Export Markdown: one `##` per section, one bullet per fact (`label — value (confidence,
source, verified?)`), provenance as a sub-list. Export JSON: the `card_json` structure
plus the full evidence array per fact plus the projection.

---

## 10. Backfill — migration `0025_candidate_memory_backfill.sql`

A one-time backfill seeding Candidate Memory from existing `user_profile` rows so no
user starts empty. Separate migration (the README rule: never bundle "add table" and
"backfill data"). It sorts after `0012` and `0024`.

**It is a one-time migration, applied once at feature launch.** The migrate CLI records
it in `_migrations` and never re-applies it; it runs before any user has Candidate
Memory, so there is no erased fact for it to reseed. `ON CONFLICT (user_id, section,
fact_key) DO NOTHING` additionally makes the *within-run* inserts safe and a hand-re-run
harmless for users who still have their backfilled facts — but it is **not** an
erase-aware guard: it is not designed to be run after launch, and the `_migrations`
tracker is what guarantees it is not. (An erased user who is later re-backfilled is a
non-scenario for a once-at-launch migration; if backfill ever needs to run again,
that is a new, erase-aware migration.)

It runs as the privileged `postgres` migrate connection — RLS is bypassed, there is no
`auth.uid()`. It therefore **does not** call the write functions; it inserts directly
with explicit `user_id`, inside one `BEGIN; … COMMIT;`, mapping onto the §3 taxonomy via
`cm_slug()` (from `0024`). Every fact is `source='system'`, `confidence='inferred'`,
`user_verified=false`; each `INSERT` is paired (via a CTE on its `RETURNING`) with
exactly one `candidate_fact_evidence` row, so backfilled facts are not provenance-blind.

```sql
-- 0025_candidate_memory_backfill.sql
-- One-time seed of candidate_facts from user_profile. Idempotent within a run
-- and safe to re-run for non-erased users (ON CONFLICT DO NOTHING); tracked in
-- _migrations so it applies exactly once. MUST sort after 0012 and 0024.

BEGIN;

-- profile scalars: name, headline, summary
WITH ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT up.user_id, 'profile', k.key,
         jsonb_build_object('text', left(k.val, 1000)),   -- 1000 chars ≤ 4 KB octets
         initcap(k.key), 'inferred', 'system', false
  FROM user_profile up
  CROSS JOIN LATERAL (VALUES ('name', up.name), ('headline', up.headline),
                             ('summary', up.summary)) AS k(key, val)
  WHERE k.val IS NOT NULL AND length(trim(k.val)) > 0
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

-- skills: one fact per array element, key = cm_slug(name)
WITH ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT up.user_id, 'skills', cm_slug(s->>'name'),
         jsonb_strip_nulls(jsonb_build_object(
           'name',  left(s->>'name', 200),
           'level', left(s->>'level', 100),
           'years', CASE WHEN s->>'years' ~ '^[0-9]+(\.[0-9]+)?$'
                         THEN (s->>'years')::numeric END)),
         left(s->>'name', 200), 'inferred', 'system', false
  FROM user_profile up
  CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(up.skills) = 'array' THEN up.skills
              ELSE '[]'::jsonb END) s
  WHERE coalesce(s->>'name','') <> ''
    AND cm_slug(s->>'name') ~ '^[a-z0-9][a-z0-9:_-]{0,254}$'
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

-- experience: work_history → position:<company>-<role>
WITH ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT up.user_id, 'experience',
         'position:' || cm_slug(w->>'company') || '-' || cm_slug(w->>'role'),
         jsonb_strip_nulls(jsonb_build_object(
           'company', left(w->>'company', 200), 'role', left(w->>'role', 200),
           'start', left(w->>'start_date', 40), 'end', left(w->>'end_date', 40))),
         left(coalesce(w->>'role','Role') || ' @ ' || coalesce(w->>'company','?'), 200),
         'inferred', 'system', false
  FROM user_profile up
  CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(up.work_history) = 'array' THEN up.work_history
              ELSE '[]'::jsonb END) w
  WHERE (coalesce(w->>'company','') <> '' OR coalesce(w->>'role','') <> '')
    AND ('position:' || cm_slug(w->>'company') || '-' || cm_slug(w->>'role'))
        ~ '^[a-z0-9][a-z0-9:_-]{0,254}$'
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

-- experience: education → education:<institution>
WITH ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT up.user_id, 'experience', 'education:' || cm_slug(e->>'institution'),
         jsonb_strip_nulls(jsonb_build_object(
           'institution', left(e->>'institution', 200), 'degree', left(e->>'degree', 200))),
         left(coalesce(e->>'degree','Education') || ' — '
              || coalesce(e->>'institution','?'), 200),
         'inferred', 'system', false
  FROM user_profile up
  CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(up.education) = 'array' THEN up.education
              ELSE '[]'::jsonb END) e
  WHERE coalesce(e->>'institution','') <> ''
    AND ('education:' || cm_slug(e->>'institution')) ~ '^[a-z0-9][a-z0-9:_-]{0,254}$'
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

-- job_search_goals: target-roles  (target_role + target_role_categories merged).
-- The CTE builds the trimmed value array first and inserts only when it is
-- non-empty, so a profile holding only blank strings yields no fact.
WITH src AS (
  SELECT up.user_id,
         ARRAY(SELECT DISTINCT trim(v) FROM unnest(
                 array_remove(up.target_role_categories || up.target_role, NULL)) v
               WHERE trim(v) <> '') AS vals
  FROM user_profile up
), ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT user_id, 'job_search_goals', 'target-roles',
         jsonb_build_object('values', to_jsonb(vals)),
         'Target roles', 'inferred', 'system', false
  FROM src WHERE cardinality(vals) > 0
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

-- job_search_goals: target-geos  (target_geo + location_preferences merged)
WITH src AS (
  SELECT up.user_id,
         ARRAY(SELECT DISTINCT trim(v) FROM unnest(
                 array_remove(up.location_preferences || up.target_geo, NULL)) v
               WHERE trim(v) <> '') AS vals
  FROM user_profile up
), ins AS (
  INSERT INTO candidate_facts (user_id, section, fact_key, fact_value, label,
                               confidence, source, user_verified)
  SELECT user_id, 'job_search_goals', 'target-geos',
         jsonb_build_object('values', to_jsonb(vals)),
         'Target locations', 'inferred', 'system', false
  FROM src WHERE cardinality(vals) > 0
  ON CONFLICT (user_id, section, fact_key) DO NOTHING
  RETURNING id, user_id
)
INSERT INTO candidate_fact_evidence (fact_id, user_id, source, source_ref, dedupe_key)
SELECT id, user_id, 'system', '{"migration":"0025"}'::jsonb, 'backfill:0025' FROM ins;

COMMIT;
```

Notes: `(s->>'years')` is cast only behind a numeric regex guard, so a non-numeric or
empty `years` yields `NULL` instead of aborting the migration. `jsonb_array_elements` is
wrapped in a `jsonb_typeof = 'array'` guard (the `0012` columns are `NOT NULL DEFAULT
'[]'`, but the guard is defensive against a malformed legacy row). Any field whose slug
is empty, or whose key fails the pattern/length check, is **skipped** rather than forced
into a malformed fact. `preferences` and `constraints` are not backfilled (`user_profile`
has no corresponding columns) — they populate from chat and future imports.

---

## 11. Test plan

The spec is "done" when every item below has a passing test. Gate per repo norm:
`bun run vitest run` + `tsc --noEmit` green before each commit.

### Migration / DB
- `migrate --all` on a clean DB applies `0024` then `0025` with no error
  (ALTER-sorts-after-CREATE holds).
- `0024` and `0025` are each idempotent — re-applying is a no-op (no duplicate facts).
- `cm_slug()` and the TS `slug()` produce identical output for a shared input set.
- `0025` against seeded `user_profile` rows produces the expected facts **and** one
  `candidate_fact_evidence` row per backfilled fact; a `user_profile` with a
  non-numeric `skills[].years` or a non-array column does not abort the migration.
- The SQL `*_taxonomy_chk` key set and the TS `FACT_TAXONOMY` list the same keys.
- A direct insert violating `*_taxonomy_chk`, `*_value_size_chk`, or the `fact_key`
  pattern is rejected.

### RLS & write-path lockdown (security-critical)
- User A cannot `SELECT` user B's rows in any of the four tables.
- A direct `INSERT`/`UPDATE`/`DELETE` on any of the four tables by an `authenticated`
  client is **rejected** (no policy, no grant).
- `anon` and `authenticated` cannot `EXECUTE` `cm__apply_fact_internal`.
- `anon` cannot `EXECUTE` any `cm_*` wrapper.
- A `candidate_fact_evidence` row with a `fact_id` belonging to another user is rejected
  by the composite FK (cross-tenant spoof test).
- A `candidate_fact_suggestions` row with a `target_fact_id` belonging to another user
  is rejected by the composite FK.

### `cm__apply_fact_internal` / `cm_apply_fact`
- New `(section, key)` → `inserted`, one evidence row, `evidence_count = 1`.
- Same value from a **different** source → `corroborated`, `evidence_count` 1→2,
  confidence `inferred`→`corroborated`.
- Same value from the **same** source twice → `corroborated`, evidence **not**
  duplicated (`(fact_id, dedupe_key)` unique), `evidence_count` unchanged.
- `cm_apply_fact` on an existing fact with the **same** value → `corroborated` **and**
  `user_verified` flips to true, `confidence` → `stated` (verify works).
- Different value, fact not verified and not corroborated → `updated`; the old evidence
  rows are deleted (stale evidence cannot corroborate the new value).
- Different value, fact `user_verified`, caller is an import → `conflict_staged`; the
  fact is unchanged; a pending suggestion exists; no evidence appended to the fact.
- Different value, fact `corroborated` (not verified), caller is an import →
  `conflict_staged` (a single import cannot flip a corroborated fact).
- Different value, fact `user_verified`, caller is `cm_apply_fact` (manual) → `updated`
  (a manual edit overwrites the user's own verified fact).
- An import apply for a tombstoned key → `skipped_tombstoned`; a manual apply for a
  tombstoned key → succeeds and clears the tombstone.
- Concurrent first-write of the same key by two sessions → one `inserted`, the other
  resolves via the `ON CONFLICT`/re-select path with no unique-violation error.
- `cm_apply_facts` with `source='chat'` or `source='manual'` → raises.
- `cm_apply_facts` with one raising fact rolls the whole batch back (atomic).

### `cm_stage_suggestions`
- Stages a batch; re-staging the same `(section, fact_key)` updates the pending row, no
  duplicate (`pending` partial unique); a malformed item is skipped, the batch survives.

### `cm_accept_suggestion`
- `pending` → `accepted`; fact created/updated as `stated` + verified; the evidence row
  records the suggestion's **original** source (`chat`/`cv_upload`/`linkedin_onboarding`),
  not `manual`.
- With `p_resolved_value` → suggestion `edited_accepted`, fact holds the edited value.
- Accepting a non-pending suggestion raises.
- Two concurrent accepts of one suggestion → one succeeds, the other raises and rolls
  back its fact apply (the `WHERE status='pending'` rowcount guard).
- No deadlock when an import (`cm_apply_facts`), an accept, a stage, and a delete touch
  the same fact concurrently (every path locks the fact before the suggestion).

### `cm_reject_suggestion`, `cm_delete_fact`, `cm_erase_memory`
- `cm_reject_suggestion` on pending → `rejected`; on non-pending → raises.
- `cm_delete_fact` hard-deletes the fact + evidence and **every** suggestion for the key
  regardless of status (an accepted/rejected `create` suggestion still holding the
  deleted `fact_value` is removed — no value survives per-fact erasure), and writes a
  tombstone.
- `cm_erase_memory` deletes all of the caller's facts/evidence/suggestions/tombstones,
  returns the count, leaves other users and the `applications` table untouched.

### Context Card (`_shared/context-card.ts`, unit)
- Renders Markdown + JSON; global trust-sort then 40-cap evicts lowest-trust first (a
  verified fact is kept unless 40+ equal-or-higher-trust facts exist); a `corroborated`
  fact ranks above `inferred`, a verified fact above both.
- Empty memory → `"(no candidate memory yet)"`, no throw.
- Query error → empty card + structured `console.error`, no throw (fail-open).

### Pipeline (`_shared/candidate-memory.ts`, unit — pure)
- `validateExtractedFacts` drops bad section / unknown fixed-key / malformed dynamic key
  / missing `fact_value` field; slug-normalises; caps strings; caps at 40/section;
  dedups within batch.
- `parseMemoryBlock` extracts the **last** fenced block when several are present;
  returns `[]` for an absent or unparseable block; **strips any syntactically detected
  `memory-suggestions` fence from the reply even when its JSON does not parse** (the
  user never sees a raw block).
- `factsFromCvAnalysis` maps a sample `analyze-cv` `RESPONSE_SCHEMA` payload to
  taxonomy-conformant `ExtractedFact[]`.

### Edge functions
- `chat`: a reply with a `memory-suggestions` block returns a `reply` with the block
  removed and `suggestions[]` from the **inserted** rows; no block → `suggestions: []`;
  a malformed block → the fence is still stripped from `reply` and `suggestions: []`; an
  `anonymous` caller → no RPC, `suggestions: []`.
- `analyze-cv`: a CV analysis produces `inferred` facts; a conflicting value vs a
  verified fact produces a suggestion not an overwrite; an RPC failure still returns the
  CV analysis (fail-open).

### Frontend (`vitest`, following `profile.test.tsx`)
- `/memory` renders section panels, the suggestion inbox, the import-review banner.
- Accept / Edit&Accept / Reject calls the right RPC.
- Export triggers Markdown + JSON downloads; "Delete all memory" calls `cm_erase_memory`
  after confirm.

---

## 12. Rollout & sequencing

Roadmap #6 — after CV radar and the News section, before agentic chat (which depends on
this layer). The numbered steps are **code-build order**, each independently shippable
and verifiable, distinct from migration-apply order: migrations `0024` and `0025` apply
together at the DB layer whenever they merge (`0025` is a one-time, no-op-safe backfill).

1. **Migration `0024`** — tables + RLS + `cm_slug` + functions. Apply; run the DB / RLS
   / write-path-lockdown / function tests.
2. **Shared modules** — `_shared/context-card.ts` + `_shared/candidate-memory.ts` (incl.
   `FACT_TAXONOMY`, `slug`), with their unit tests.
3. **Readers** — inject the Context Card into `chat`, `analyze-cv`, `draft-message`,
   `match-job`; stop injecting the client `profile`/`applications` fields (still
   accepted, just ignored — no lockstep deploy, §6.3).
4. **Writers** — `analyze-cv` import via `cm_apply_facts`; `chat` staged-suggestion
   extraction + `suggestions[]` response field.
5. **Buddy's Brain UI** — `/memory` route, nav entry, suggestion inbox, fact panels,
   export, erase.
6. **Backfill `0025`** — apply once; verify facts appear in `/memory`.
7. **LinkedIn onboarding writer** — when `feat/linkedin-onboarding` merges, its
   onboarding function calls `cm_apply_facts` with `source='linkedin_onboarding'`
   (integration point only; not in this branch's scope).
8. **Cleanup ADR (later)** — drop the now-ignored client `profile`/`applications`
   request fields from the four readers and the frontend; retire `user_context_notes`.

---

## 13. Deferred to v1.1 (explicitly out of scope)

- `saved_job` as an extraction source. **Not** in any v1 enum — added when wired, so v1
  carries no unused schema surface.
- Function-calling / structured tool output for chat extraction, replacing the
  fenced-block approach, once quota headroom or a model with reliable parallel
  text+tool output is available.
- Fact-value history / an audit of superseded values (v1 updates in place; the evidence
  trail records each current-value signal but not prior `fact_value`s).
- A `candidate_context_card` cache table, if profiling shows the per-read card query
  matters.
- A GIN index on `candidate_facts.fact_value` for skill-containment search (mirrors
  `user_profile_skills_gin_idx`).
- A stricter source-independence model for corroboration (distinguishing genuinely
  independent evidence from copied underlying content).
- Retrieval augmentation over the structured facts for very large memories.
- Retiring `user_profile` / `user_context_notes` (their own cleanup ADR).
```
