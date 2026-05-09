"""Backfill ``jobs.description`` and ``jobs.requirements`` from existing
``raw_payload`` jsonb. Pure DB read-modify-write — no HTTP.

Usage::

    uv run python -m career_buddy_scraper.cli.backfill_descriptions
    uv run python -m career_buddy_scraper.cli.backfill_descriptions --force
    uv run python -m career_buddy_scraper.cli.backfill_descriptions --ats greenhouse
    uv run python -m career_buddy_scraper.cli.backfill_descriptions --limit 200

Default scope: rows where ``is_active = true`` AND
``(description IS NULL OR length(description) < 100)`` AND
``ats_source IN ('greenhouse', 'lever', 'ashby')``.

``--force`` drops the description-length predicate (re-extract everything).
``--ats`` narrows to a single source.
``--limit`` caps total rows processed (default: no cap).

Resumability: per-batch commit (200 rows). Crashes mid-run leave already-
committed batches written; restart picks up where it left off via the
description-length predicate (or use ``--force`` to ignore).

Stats are printed at the end. Sample failures (first 5) are logged.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from typing import Any

from rich.console import Console

from ..db import connect, load_env
from ..descriptions import extract

load_env()

console = Console()

SUPPORTED_ATS = ("greenhouse", "lever", "ashby")
BATCH_SIZE = 200
MAX_FAILURE_SAMPLES = 5


def _select_sql(force: bool, ats: str | None, limit: int | None) -> tuple[str, list[Any]]:
    where = ["is_active = true"]
    params: list[Any] = []
    if not force:
        # Resume on description-missing OR description-OK-but-requirements-still-empty.
        where.append(
            "(description is null or length(description) < 100"
            " or requirements is null or length(requirements) < 30)"
        )
    if ats:
        where.append("ats_source = %s")
        params.append(ats)
    else:
        placeholders = ", ".join(["%s"] * len(SUPPORTED_ATS))
        where.append(f"ats_source in ({placeholders})")
        params.extend(SUPPORTED_ATS)
    sql = (
        "select id::text, ats_source, raw_payload, role_title from jobs where "
        + " and ".join(where)
        + " order by id"
    )
    if limit:
        sql += " limit %s"
        params.append(limit)
    return sql, params


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-extract even when description already populated.")
    parser.add_argument("--ats", choices=SUPPORTED_ATS, default=None, help="Restrict to a single ATS source.")
    parser.add_argument("--limit", type=int, default=None, help="Cap rows processed.")
    parser.add_argument("--dry-run", action="store_true", help="Compute extractions but skip the UPDATE.")
    args = parser.parse_args()

    select_sql, params = _select_sql(force=args.force, ats=args.ats, limit=args.limit)

    counters: dict[str, int] = defaultdict(int)
    by_ats: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    failures: list[dict[str, Any]] = []

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, params)
            rows = cur.fetchall()
        console.print(f"[bold]backfill descriptions[/bold]: {len(rows)} candidate rows")
        if not rows:
            return 0

        pending: list[tuple[str, str, str]] = []
        for job_id, ats_source, raw_payload, role_title in rows:
            counters["total_seen"] += 1
            by_ats[ats_source]["total"] += 1
            if not raw_payload:
                counters["skipped_no_payload"] += 1
                by_ats[ats_source]["skipped_no_payload"] += 1
                continue
            try:
                description, requirements = extract(ats_source, raw_payload)
            except Exception as e:
                counters["errored"] += 1
                by_ats[ats_source]["errored"] += 1
                if len(failures) < MAX_FAILURE_SAMPLES:
                    failures.append(
                        {"id": job_id, "ats": ats_source, "title": role_title, "error": f"{type(e).__name__}: {e}"}
                    )
                continue
            if not description or len(description) < 50:
                counters["skipped_no_description"] += 1
                by_ats[ats_source]["skipped_no_description"] += 1
                continue
            pending.append((job_id, description, requirements or ""))

        console.print(
            f"  ready: {len(pending)} updates, "
            f"skipped {counters['skipped_no_description']} (no/short desc), "
            f"errored {counters['errored']}"
        )

        if args.dry_run or not pending:
            _print_summary(counters, by_ats, failures)
            return 0

        with conn.cursor() as cur:
            for chunk_start in range(0, len(pending), BATCH_SIZE):
                chunk = pending[chunk_start : chunk_start + BATCH_SIZE]
                cur.executemany(
                    "update jobs set description = %s, requirements = nullif(%s, '') where id = %s",
                    [(d, r, jid) for (jid, d, r) in chunk],
                )
                conn.commit()
                counters["updated"] += len(chunk)
                console.print(f"  [green]committed batch {chunk_start}-{chunk_start + len(chunk)}[/green]")

    _print_summary(counters, by_ats, failures)
    return 0


def _print_summary(
    counters: dict[str, int],
    by_ats: dict[str, dict[str, int]],
    failures: list[dict[str, Any]],
) -> None:
    console.print()
    console.print("[bold]summary[/bold]")
    for k in ("total_seen", "updated", "skipped_no_payload", "skipped_no_description", "errored"):
        console.print(f"  {k:30} {counters.get(k, 0):>6}")
    console.print()
    console.print("[bold]by ats[/bold]")
    for ats, c in sorted(by_ats.items()):
        console.print(
            f"  {ats:12} total={c['total']:5} "
            f"skipped_no_desc={c.get('skipped_no_description', 0):5} "
            f"errored={c.get('errored', 0):3}"
        )
    if failures:
        console.print()
        console.print(f"[yellow]first {len(failures)} failures:[/yellow]")
        for f in failures:
            console.print(f"  - {f['ats']} {f['id']} '{f['title'][:50]}': {f['error']}")


if __name__ == "__main__":
    sys.exit(main())
