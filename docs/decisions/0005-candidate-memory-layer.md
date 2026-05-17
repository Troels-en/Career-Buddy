# 0005 — Candidate Memory: a hosted, user-owned context layer

- **Status:** Accepted
- **Date:** 2026-05-17
- **Deciders:** Troels Enigk
- **Companion:** [0005-candidate-memory-build-spec.md](0005-candidate-memory-build-spec.md) — the build-ready spec
- **Strategy record:** `~/Career-Buddy_Vault/05_Decisions/0002-user-owned-candidate-memory.md`

## Context

Career-Buddy's knowledge of the candidate is fragmented and one-shot. LinkedIn-URL
onboarding builds a profile snapshot, then it is frozen. CV radar reads a parsed CV.
Buddy chat learns things mid-conversation that vanish when the thread ends. Application
history lives in its own table. Nothing accumulates; Buddy starts cold every session.

The persistence that exists today is a flat mirror, not a memory:

- `user_profile` (migration 0012) — a single row mirroring the CV-analyzed profile
  (`skills`, `work_history`, `education`, `target_role`, …). Last-write-wins, no
  provenance, no confidence, no history.
- `user_context_notes` (migration 0013) — append-only free-text notes tagged by
  `source`. Unstructured; never read back into any prompt today; no evidence model.
- The `chat` edge function receives `profile` and `applications` **from the client
  request body** and summarises them inline. The context is client-supplied (stale,
  spoofable) and per-call.

Reviewing the OSS project `floomhq/icontext` (an encrypted, local-first AI context
vault for developer tools) surfaced the gap and a usable shape: a tiered context model,
evidence thresholds, a deterministic synthesis pipeline, per-fact provenance, an explicit
correction loop, and a portable export. Codex and Gemini were both consulted on the
strategy and independently concluded the concept is right for Career-Buddy but the
local-first developer-tool form (git-crypt vault, MCP server, local Markdown folders,
browser automation) is wrong for a consumer SaaS aimed at non-developer job seekers.

The moat Career-Buddy is betting on is not the job feed (scrapeable) or the chat
(commodity). It is **career-specific longitudinal context, owned by and transparent to
the user**. That asset only compounds if it is built as a shared layer every feature
reads from and writes to — not as another bolt-on screen wired late.

## Decision

**Build Candidate Memory: a hosted, transparent, user-owned context layer in Supabase
Postgres, structured as atomic facts with per-fact provenance, an evidence/confidence
model, and a staged-suggestion approval flow. Every meaningful AI surface reads it; chat,
imports, and manual edits write it. It is a layer, not a screen.**

Specifics:

- **Atomic facts, not a blob.** A `candidate_facts` table holds one row per atomic
  claim, grouped into **seven stored `section`s** (`profile`, `experience`, `skills`,
  `preferences`, `job_search_goals`, `constraints`, `assistant_notes`) plus one
  **projected** section (`application_history`, composed live from the existing
  `applications` table — referenced, not duplicated). No ever-growing vector blob, no
  free-form document.
- **Provenance per fact.** Every fact carries `source`, `confidence`, `last_seen`,
  `user_verified`, and a `candidate_fact_evidence` trail of the individual signals that
  support its current value.
- **Writes only through audited functions.** Clients cannot write the fact tables
  directly: row-level security grants read-only access, and every write goes through
  `SECURITY DEFINER` RPCs that own the evidence, provenance, confidence, and
  staged-suggestion rules. This makes the provenance model impossible to bypass.
- **Evidence/confidence model.** Confidence is a three-value enum
  (`stated` / `inferred` / `corroborated`), not a numeric score. A single weak signal is
  never a core fact; promotion to `corroborated` requires corroboration from a second
  independent source.
- **Staged suggestions, never silent writes.** Chat-derived facts land in
  `candidate_fact_suggestions` as a review queue. Buddy states out loud what it staged.
  The user accepts, edits-and-accepts, or rejects. Only document imports the user
  actively triggered (LinkedIn onboarding, CV upload) and manual edits write
  `candidate_facts` directly — imports as unverified, manual edits as ground truth.
- **Server-derived Context Card.** A compact card is rendered server-side from the
  caller's own facts by a shared helper (`_shared/context-card.ts`) and injected into
  the `chat`, `analyze-cv`, `draft-message`, and `match-job` edge functions. It replaces
  the client-supplied `profile` block, which is stale and spoofable.
- **Transparent UI — "Buddy's Brain."** A `/memory` route shows every fact as an
  editable field with its confidence, source, provenance trail, and a delete control,
  plus the pending-suggestion inbox and an import-review state.
- **GDPR-native surface.** One-click export (Markdown + JSON, Art. 20), per-fact and
  full-memory erasure (Art. 17), provenance visible per fact (Art. 13/14), a fixed
  section enum and no email-body ingestion (data minimisation). Consistent with
  `0001-eu-first-focus` is not an ADR here; the strategy record is `0001-eu-first-focus`
  in the vault.
- **A layer other features depend on.** LinkedIn onboarding and `analyze-cv` become
  writers; `chat`, `analyze-cv`, `draft-message`, `match-job` become readers; the
  planned agentic chat feature is unblocked by it. The `applications` table is
  *referenced* by `application_history` facts, not wrapped or duplicated.

The full schema, pipeline, edge-function contracts, UI breakdown, migration, test plan,
and rollout are in the companion build spec.

## Consequences

**Positive**

- Establishes the real moat — longitudinal, user-owned career context — over the
  commodity job feed and chat. Every downstream AI surface gets better context for free.
- Unblocks the planned agentic chat feature, which needs a stateful candidate layer.
- "Transparent, user-owned career memory" becomes positioning material against
  opaque-AI competitors (Clera).
- Server-derived context removes a real correctness/security weakness: the `chat`
  function no longer trusts a client-supplied `profile` body.
- Per-fact rows make GDPR erasure granular and portability a plain `SELECT`.

**Negative**

- A new persistence layer with four tables (facts, evidence, suggestions, tombstones), a
  set of write-path SQL functions, a synthesis pipeline, a shared edge-function helper,
  and a new UI route. Non-trivial; sequenced as Roadmap #6.
- Two LLM responsibilities are added to chat (converse + stage suggestions). Mitigated by
  doing it in the single existing chat call — the model appends a fenced JSON block to
  its reply — not a second call, to stay within the Gemini free-tier daily quota.
- Every reader edge function gains a dependency on the Context Card helper. A bug there
  degrades four functions at once. Mitigated: the helper fails open (empty card, never an
  error) and is unit-tested in isolation.
- The four reader functions stop trusting the client-supplied `profile` block. To avoid
  a frontend/edge lockstep deploy, v1 keeps *accepting* the `profile` request field
  (old clients do not break) but stops *injecting* it into any prompt — the
  server-rendered Context Card becomes the sole profile context. A later cleanup ADR
  removes the now-ignored field from the request contract and the client.

**Neutral**

- `user_profile` and `user_context_notes` are not dropped. `user_profile` remains the
  CV-analysis mirror and a seed source for the one-time backfill; `user_context_notes`
  is superseded in role but left in place. A later ADR may retire them.
- Confidence is deliberately coarse (three values). If a finer signal is ever needed,
  `evidence_count` already carries the underlying strength.

## Alternatives considered

- **Single `candidate_context` JSONB document per user.** One row, sections as keys,
  provenance embedded. Rejected: per-fact RLS, granular erasure, evidence counting,
  partial-unique "one active fact per key", and staged-suggestion diffing all become
  in-application JSON surgery instead of plain SQL. The blob is exactly the "ever-growing
  memory that bloats and drifts" trap.
- **Vector store / embedding memory.** Rejected for v1: unstructured, hard to show the
  user, hard to edit or erase a specific fact, and prone to weak-signal drift. The
  product promise is a *transparent* memory; a vector blob is the opposite. Retrieval
  augmentation can be layered on later over the structured facts if needed.
- **Copy icontext's architecture (git-crypt vault + MCP server + local Markdown).**
  Rejected: job seekers are not developers; they will not run a CLI, manage encryption
  keys, or install an MCP server. The concept is portable; the form is not.
- **Extend `user_context_notes` instead of new tables.** Rejected: it has no
  fact/key structure, no confidence, no provenance trail, no staging, no "one active
  value per key". Bolting all of that onto a free-text notes table is a bigger and
  messier change than three purpose-built tables.
- **Auto-write chat facts directly (no staging).** Rejected outright: it is the
  single most-cited trap. Silent profile mutation from conversation is creepy,
  GDPR-hostile, and destroys trust. Staging is the trust feature.
- **Defer chat-staging to v1.1 (import-only v1).** Rejected: without chat as a write
  source, Candidate Memory v1 is just a re-skinned profile mirror and does not earn the
  "layer" framing. Single-call extraction (the model appends a fenced JSON block to its
  chat reply — no second call) makes chat-staging quota-cheap enough to ship in v1;
  structured tool/function-calling is a v1.1 upgrade.
- **Per-call retrieval instead of a precomputed card.** Rejected for v1: the memory is
  a few KB; a precomputed compact card avoids per-call retrieval latency and the
  associated context-window cost.
  The build spec keeps the card cheap to regenerate so this stays true.
