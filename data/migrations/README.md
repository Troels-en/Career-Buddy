# Database migrations

Sequential, append-only SQL files applied to the Career-Buddy Supabase project. Each filename: `NNNN_kebab_slug.sql`.

## Apply a migration

```bash
cd scripts/scraper
uv run python -m career_buddy_scraper.cli.migrate /path/to/file.sql
# or apply every unapplied migration in order:
uv run python -m career_buddy_scraper.cli.migrate --all
```

The CLI reads `SUPABASE_DB_URL` from `../../.env`, opens a single transaction per file, and records applied filenames in the `_migrations` table.

## Rules

- Never edit a migration after it has been applied. Add a new file with a higher sequence number.
- Migrations must be idempotent (`create table if not exists`, `drop trigger if exists`, etc.) so re-runs are safe.
- One concern per migration. Don't bundle "add table" and "backfill data" in the same file.

## Index

| # | File | Status | Adds |
|---|---|---|---|
| 0001 | [0001_layer0_baseline.sql](0001_layer0_baseline.sql) | applied | users, applications, events, vc_jobs |
| 0002 | [0002_layer1_scraper.sql](0002_layer1_scraper.sql) | pending | vcs, jobs, updated_at trigger |
