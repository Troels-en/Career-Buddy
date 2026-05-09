"""Preflight dry-run against the four ATS providers.

Picks one publicly-known slug per provider via HEAD probing, fetches its
job board, and asserts the response shape matches each adapter's
expectations. NO database writes. NO normalize / validate.

Per workplan v6 Step 0:

- ≥ 3 of 4 providers must respond 200.
- Limiter peak req/min ≤ 100 (≤ ~30 actual requests including HEAD probes).
- File ``artifacts/preflight-<ts>.json`` lists each resolved provider with
  non-zero ``result_count``.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from typing import Any

from rich.console import Console

from ..db import REPO_ROOT
from ..http import RateLimitedClient, TokenBucket

console = Console()

CANDIDATES: dict[str, list[str]] = {
    # provider → list of candidate slugs (probed directly against the API
    # endpoint; first slug returning 200 with the expected shape wins).
    "greenhouse": ["cherryventures", "airbnb", "gitlab", "anduril", "doordash"],
    "lever": ["mistral", "ramp", "deel", "palantir-tech", "lever"],
    "ashby": ["notionhq", "ramp", "hex", "perplexity", "anthropic"],
    "workable": ["circleci", "remotecom", "lemonade", "automattic", "fnatic"],
}

ENDPOINT_BUILDERS: dict[str, str] = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
    "workable": "https://apply.workable.com/api/v3/accounts/{slug}/jobs",
}

EXPECTED_TOP_KEYS: dict[str, set[str]] = {
    "greenhouse": {"jobs"},
    # Lever returns a top-level list, no dict keys to check
    "lever": set(),
    "ashby": {"jobs"},
    "workable": {"results"},
}


async def probe_one(client: RateLimitedClient, provider: str, slug: str) -> dict[str, Any]:
    """Hit the provider's API endpoint for ``slug`` and validate top-level shape."""
    endpoint = ENDPOINT_BUILDERS[provider].format(slug=slug)
    record: dict[str, Any] = {
        "provider": provider,
        "slug": slug,
        "endpoint": endpoint,
        "status": None,
        "result_count": 0,
        "shape_ok": False,
        "top_keys": [],
    }
    try:
        if provider == "workable":
            resp = await client.post(endpoint, json={"limit": 100})
        else:
            resp = await client.get(endpoint)
    except Exception as e:
        record["error"] = str(e)
        return record
    record["status"] = resp.status_code
    if resp.status_code != 200:
        return record
    try:
        payload = resp.json()
    except ValueError:
        return record
    if provider == "lever":
        if isinstance(payload, list):
            record["result_count"] = len(payload)
            record["shape_ok"] = True
            record["top_keys"] = ["<list>"]
        return record
    if isinstance(payload, dict):
        record["top_keys"] = sorted(payload.keys())
        record["shape_ok"] = EXPECTED_TOP_KEYS[provider].issubset(payload.keys())
        if record["shape_ok"]:
            top_key = next(iter(EXPECTED_TOP_KEYS[provider]))
            inner = payload.get(top_key, [])
            record["result_count"] = len(inner) if isinstance(inner, list) else 0
    return record


async def resolve_provider(client: RateLimitedClient, provider: str) -> dict[str, Any]:
    """Try each candidate slug; first one with shape_ok and result_count > 0 wins."""
    last_record: dict[str, Any] = {
        "provider": provider,
        "slug": None,
        "status": None,
        "result_count": 0,
        "shape_ok": False,
        "top_keys": [],
    }
    for slug in CANDIDATES[provider]:
        record = await probe_one(client, provider, slug)
        last_record = record
        if record["shape_ok"] and record["result_count"] > 0:
            console.print(
                f"[green]{provider}: resolved → {slug} ({record['result_count']} jobs)[/green]"
            )
            return record
        console.print(
            f"[dim]{provider} {slug}: status={record.get('status')} "
            f"shape_ok={record['shape_ok']}[/dim]"
        )
    console.print(f"[yellow]{provider}: no candidate resolved[/yellow]")
    return last_record


async def main() -> int:
    timestamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    out_path = REPO_ROOT / "artifacts" / f"preflight-{timestamp}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    async with RateLimitedClient(
        bucket=TokenBucket(100, 60.0),
        per_host_delay_s=0.2,
    ) as client:
        records = [await resolve_provider(client, p) for p in CANDIDATES]
        metrics = client.metrics()

    metrics_summary = {
        "total_requests": metrics["total_requests"],
        "cache_hits": metrics["cache_hits"],
        "peak_per_minute": metrics["peak_per_minute"],
        "by_method": metrics["by_method"],
        "by_status": metrics["by_status"],
    }
    payload = {
        "timestamp_utc": timestamp,
        "providers": records,
        "limiter_metrics": metrics_summary,
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    succeeded = sum(1 for r in records if r.get("shape_ok") and r["result_count"] > 0)
    peak = metrics_summary["peak_per_minute"]
    console.print()
    console.print(f"[bold]Preflight summary[/bold] → {out_path}")
    console.print(f"  providers OK: {succeeded} / {len(records)}")
    console.print(f"  peak req/min: {peak}")
    console.print(f"  total HTTP : {metrics_summary['total_requests']}")

    if succeeded < 3:
        console.print("[red]FAILED[/red]: < 3 providers responded with usable shape")
        return 1
    if peak > 100:
        console.print(f"[red]FAILED[/red]: peak req/min {peak} exceeds 100 cap")
        return 2
    console.print("[green]OK[/green]")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
