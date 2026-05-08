# Architecture Decision Records (ADRs)

Each significant architecture or strategy decision lives here as a standalone Markdown file. Keep it short, dated, and immutable once accepted — supersede with a new ADR rather than rewriting history.

## Format

`NNNN-kebab-slug.md`, four-digit zero-padded sequence. Each file:

```markdown
# NNNN — Title

- **Status:** Proposed | Accepted | Superseded by NNNN | Deprecated
- **Date:** YYYY-MM-DD
- **Deciders:** name(s)

## Context

What is the issue, constraint, or background that motivates the decision?

## Decision

What we are doing. State it as one sentence, then bullets for the specifics.

## Consequences

Positive, negative, neutral effects. What becomes easier? What becomes harder? What did we explicitly trade away?

## Alternatives considered

Brief one-paragraph each. Why rejected.
```

## Index

| # | Title | Status | Date |
|---|---|---|---|
| 0001 | [Mock-mode for Layer 0 hackathon build](0001-mock-mode-layer-0.md) | Accepted | 2026-05-07 |
| 0002 | [Three-lane tracking: repo / Obsidian / Notion](0002-three-lane-tracking.md) | Accepted | 2026-05-08 |
| 0003 | [Python + uv for Layer-1 scraper](0003-python-uv-scraper.md) | Accepted | 2026-05-08 |

## When to write an ADR

Write one when the decision:

- Affects more than one file or surface (frontend ↔ backend, repo ↔ external).
- Is hard to reverse later (database choice, language choice, auth model).
- Explicitly trades one quality for another (determinism vs realism, speed vs scale, cost vs flexibility).
- Cuts scope or rejects a tempting alternative the future-self might re-propose.

Skip ADRs for: bug fixes, copy edits, single-file refactors, library version bumps, UI tweaks.
