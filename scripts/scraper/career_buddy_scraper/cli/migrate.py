"""Apply SQL migrations from ``data/migrations/`` to the configured Supabase DB.

Usage:

    uv run python -m career_buddy_scraper.cli.migrate            # apply all pending
    uv run python -m career_buddy_scraper.cli.migrate FILE.sql   # apply one file

Tracks applied filenames in a ``_migrations`` table so re-runs are no-ops. Each
file runs inside its own transaction; a failure rolls back that file but
preserves earlier successful migrations.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rich.console import Console

from ..db import REPO_ROOT, connect

MIGRATIONS_DIR = REPO_ROOT / "data" / "migrations"
console = Console()


def _ensure_tracking_table(cur: object) -> None:
    cur.execute(  # type: ignore[attr-defined]
        """
        create table if not exists _migrations (
            filename text primary key,
            applied_at timestamptz default now()
        );
        """
    )


def _applied(cur: object) -> set[str]:
    cur.execute("select filename from _migrations;")  # type: ignore[attr-defined]
    return {row[0] for row in cur.fetchall()}  # type: ignore[attr-defined]


def _apply_one(path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    with connect() as conn:
        with conn.cursor() as cur:
            _ensure_tracking_table(cur)
            already = _applied(cur)
            if path.name in already:
                console.print(f"[dim]· {path.name} already applied[/dim]")
                return
            console.print(f"[cyan]→ applying {path.name}[/cyan]")
            cur.execute(sql)
            cur.execute(
                "insert into _migrations (filename) values (%s);",
                (path.name,),
            )
        conn.commit()
        console.print(f"[green]✓ {path.name}[/green]")


def _list_pending() -> list[Path]:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    with connect() as conn:
        with conn.cursor() as cur:
            _ensure_tracking_table(cur)
            applied = _applied(cur)
        conn.commit()
    return [f for f in files if f.name not in applied]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "file",
        nargs="?",
        help="Apply a single migration file (path). Omit to apply all pending.",
    )
    args = parser.parse_args(argv)

    if args.file:
        path = Path(args.file)
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        if not path.exists():
            console.print(f"[red]not found: {path}[/red]")
            return 1
        _apply_one(path)
        return 0

    pending = _list_pending()
    if not pending:
        console.print("[green]nothing to apply, database is up to date[/green]")
        return 0
    for path in pending:
        _apply_one(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
