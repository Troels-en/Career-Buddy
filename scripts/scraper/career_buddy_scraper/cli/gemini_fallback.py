"""Gemini-powered fallback for entities without a supported ATS slug.

For each VC/company in ``vcs`` whose ``careers_url`` is not on a known ATS
host, fetch the page HTML, hand it to :class:`GeminiScraper`, and upsert
the extracted jobs as ``CanonicalJob`` rows with ``ats_source=custom``.

Free-tier budget: gemini-2.5-flash 1500 RPD. Typical 1-3 calls per page,
so ~500 pages/day comfortably within budget. STOPs on QuotaExhausted —
never auto-falls-back to paid API.
"""

from __future__ import annotations

import asyncio
import sys
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from rich.console import Console

from ..db import REPO_ROOT, connect, load_env
from ..gemini_scraper import GeminiScraper, QuotaExhausted
from ..jobs_repo import upsert_jobs
from ..models import AtsSource, CanonicalJob

load_env()  # ensure GEMINI_API_KEY visible to GeminiScraper

console = Console()

# Hosts that are already covered by our ATS adapters. Skip these — they
# have direct API endpoints and don't need LLM extraction.
ATS_HOSTS = (
    "boards.greenhouse.io",
    "greenhouse.io",
    "jobs.lever.co",
    "jobs.ashbyhq.com",
    "apply.workable.com",
    "jobs.personio.de",
    "jobs.personio.com",
    ".recruitee.com",
)


def _is_ats_url(url: str) -> bool:
    host = (urlparse(url).netloc or "").lower()
    return any(h in host for h in ATS_HOSTS)


def _candidate_targets() -> list[dict[str, str]]:
    """Pull VCs whose careers_url is not on a supported ATS host."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select domain, name, careers_url
            from vcs
            where careers_url is not null and careers_url <> ''
            order by domain;
            """
        )
        rows = cur.fetchall()
    out: list[dict[str, str]] = []
    for domain, name, careers_url in rows:
        if not _is_ats_url(str(careers_url)):
            out.append({"domain": str(domain), "name": str(name), "url": str(careers_url)})
    return out


async def _fetch_html(url: str, client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(url, follow_redirects=True, timeout=30)
    except Exception as e:
        console.print(f"[red]  fetch error: {e}[/red]")
        return None
    if resp.status_code >= 400:
        console.print(f"[dim]  HTTP {resp.status_code}[/dim]")
        return None
    return resp.text


def _build_canonical(
    raw: dict[str, Any], company_name: str, company_domain: str
) -> CanonicalJob | None:
    title = (raw.get("role_title") or "").strip()
    url = (raw.get("url") or "").strip()
    if not title or not url:
        return None
    if not url.startswith(("http://", "https://")):
        return None
    try:
        return CanonicalJob(
            company_name=str(raw.get("company_name") or company_name),
            company_domain=company_domain.lower(),
            role_title=title,
            location=raw.get("location") or None,
            is_remote=bool(raw.get("is_remote")),
            employment_type=raw.get("employment_type") or None,
            url=url,  # type: ignore[arg-type]
            description=raw.get("description") or None,
            posted_date=None,
            ats_source=AtsSource.CUSTOM,
            raw_payload=raw,
        )
    except Exception as e:
        console.print(f"[red]  validation error on '{title}': {e}[/red]")
        return None


async def main(limit: int | None = None) -> int:
    targets = _candidate_targets()
    if limit:
        targets = targets[:limit]
    console.print(f"[bold]gemini-fallback[/bold]: {len(targets)} candidate URLs")

    scraper = GeminiScraper()
    total_extracted = 0
    total_upserted = 0
    timestamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    failures: list[dict[str, str]] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)"},
    ) as client:
        for target in targets:
            name = target["name"]
            url = target["url"]
            domain = target["domain"]
            console.print(f"[cyan]→[/cyan] {name:<30} {url}")
            html = await _fetch_html(url, client)
            if html is None or len(html) < 500:
                failures.append({"name": name, "url": url, "reason": "no html"})
                continue
            try:
                raw_jobs = scraper.extract_jobs(html, url)
            except QuotaExhausted as e:
                console.print(f"[red]Gemini quota exhausted: {e}[/red]")
                console.print("[red]STOP — not auto-falling back to paid API[/red]")
                break
            except Exception as e:
                console.print(f"[red]  Gemini error: {e}[/red]")
                failures.append({"name": name, "url": url, "reason": f"gemini: {e}"})
                continue
            console.print(f"  Gemini → {len(raw_jobs)} jobs")
            total_extracted += len(raw_jobs)
            records: list[CanonicalJob] = []
            for raw in raw_jobs:
                rec = _build_canonical(raw, name, domain)
                if rec is not None:
                    records.append(rec)
            if records:
                inserted, updated = upsert_jobs(records)
                total_upserted += inserted + updated
                console.print(f"  upserted {inserted}+{updated}")

    artifacts = REPO_ROOT / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    if failures:
        import json

        (artifacts / f"gemini-fallback-failures-{timestamp}.json").write_text(
            json.dumps(failures, indent=2), encoding="utf-8"
        )

    console.print()
    console.print(
        f"[bold]gemini-fallback done[/bold]: extracted {total_extracted}, "
        f"upserted {total_upserted}, failures {len(failures)}"
    )
    return 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="Process only first N candidates (for smoke-test)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(limit=args.limit)))
