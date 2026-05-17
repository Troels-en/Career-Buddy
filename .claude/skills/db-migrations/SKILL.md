---
name: db-migrations
description: Use this skill when creating, numbering, renumbering, or applying a SQL migration in the Career-Buddy repo. Trigger on "add a migration", "new migration", "migration number", "migration collision", "renumber a migration", or any edit under data/migrations/ or supabase/migrations/. Do NOT use for editing row data, writing app/PostgREST queries, RLS-policy questions unrelated to a migration file, or non-Career-Buddy repos.
---

# Career-Buddy SQL migrations

Career-Buddy keeps schema in **numbered, forward-only SQL migrations**. This
skill covers picking a safe number and the dual-file layout — the mechanics
that cause silent collisions when several feature branches run in parallel.

Base rules (idempotency, never-edit-applied, one-concern-per-file) live in
`data/migrations/README.md` — read it; this skill does not repeat it.

## When to use

- Creating a new migration (`add a migration`, `new table`, schema change).
- Choosing or changing a migration number.
- Resolving a migration-numbering collision between branches.
- Editing anything under `data/migrations/` or `supabase/migrations/`.

## When NOT to use

- Editing row data, or writing app / PostgREST queries.
- RLS-policy design questions not tied to writing a migration file.
- Any repo that is not Career-Buddy.

## The dual-file layout

Every migration is **two files with identical SQL**:

| Path | Name | Role |
|---|---|---|
| `data/migrations/` | `NNNN_slug.sql` | canonical; applied by the migrate CLI |
| `supabase/migrations/` | `20260515HHMMSS_slug.sql` | Supabase CLI mirror |

The mirror's first line is the canonical name plus ` (mirror)`:
`-- 0026_whatsapp_link.sql (mirror)`.

Apply with the CLI (reads `data/migrations/`, tracks applied filenames in the
`_migrations` table, one transaction per file):

```bash
cd backend && uv run python -m career_buddy_scraper.cli.migrate
```

Numbering gaps are fine — the CLI applies by filename presence, not by a
contiguous sequence.

## Picking the number — claim before you create

The `NNNN` prefixes are **one shared sequence** across every feature branch.
Parallel sessions that each grab "the next free number" collide.

**Before creating a migration:**

1. Open the migration map in the active `WORKPLAN-*.md` (the table headed
   "Migration file map"). It pre-assigns numbers per feature.
2. Take **your feature's assigned number**. If your feature has none, take the
   next number **above every reserved entry** — not the next visually-free one.
3. A reserved slot can look empty: the owning feature may have *deferred* its
   migration, so no file exists yet. An empty slot is still claimed. Never
   reuse a number listed in the map for another feature.
4. Prefer to finalise the number **at merge time**, not while writing on a
   branch — branches that pick numbers independently are exactly what
   collides. If you must number early, reconcile against `origin/main` and the
   map before merge.

`supabase/migrations/` timestamp names (`20260515HHMMSS_`) effectively never
collide; the collision risk is entirely in the `data/migrations/NNNN_` prefix.

### The collision this skill exists to prevent

A WhatsApp branch took `0019` because that slot *looked* free. `0019` was
reserved in the map for F1's `user_top_jobs_cache`, which F1 had deferred — so
no `0019_*.sql` existed yet. The migration ended up sitting on another
feature's number and had to be renumbered before it could ship. The map only
works if every session reads it.

## Ordering rule — ALTER sorts after CREATE

A migration that `ALTER`s (or references) an existing table **must sort after**
the migration that created that table. The migrate CLI and a clean
`migrate --all` rebuild apply files in lexical filename order; an `ALTER` that
sorts first hits a missing table and the rebuild fails.

Consequence: a fix/extension to an already-shipped table cannot reuse a low
"reserved gap" number below the table's `CREATE` migration — it needs a number
higher than that `CREATE`.

## Renumbering an un-applied migration

Safe **only while the migration has not been applied to Supabase** (not in the
`_migrations` table). If it is applied, do not rename — write a new migration.

1. `git mv data/migrations/OLD_slug.sql data/migrations/NEW_slug.sql`.
2. Do the same for the `supabase/migrations/` mirror if one exists.
3. Fix the `-- NNNN_slug.sql` header comment on line 1 of both files.
4. `git grep -n "OLD"` across `data supabase backend src` — update every code
   comment / doc that names the old migration number. Ignore lockfiles.
5. Update the WORKPLAN migration map.
6. Commit; stage explicit paths (a stale `git add` of the pre-rename path
   aborts the whole `add` — verify the diff shows the content edits, not just
   a 100%-similarity rename).

## Failure modes

- **Reserved slot looks empty** → it is still claimed; check the map, not the
  directory listing.
- **`migrate --all` fails on a clean rebuild** → an `ALTER` migration sorts
  before its table's `CREATE`; renumber it higher.
- **Renaming an already-applied migration** → the CLI sees the new name as
  unapplied and re-runs it; never rename applied migrations, add a new one.
- **No WORKPLAN / no migration map** → take the next number above the highest
  existing file in `data/migrations/`, and flag that the map is missing.
