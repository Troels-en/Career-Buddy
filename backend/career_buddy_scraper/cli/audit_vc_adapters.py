"""Probe zero-job VCs to classify why they aren't producing jobs.

Reads `vcs` rows where the active-job count is 0 and `skip_probe = false`,
fetches each VC's `careers_url`, scans the HTML for known ATS embed
patterns (supported + unsupported), and writes a CSV with a
recommendation column. Output drives the per-VC fix decisions for
Gap 1 of session D's coverage-expansion roadmap.

Recommendations:
- `fix_supported_ats` — careers page hosts a supported ATS embed but
  no jobs were ingested; adapter / discovery bug.
- `add_adapter:<name>` — careers page hosts an unsupported ATS
  (workday, smartrecruiters, etc.); candidate for adapter expansion
  if ≥3 VCs share it.
- `skip_probe:no_careers_url` — VC row has no `careers_url`; nothing
  to scrape.
- `skip_probe:dead_url` — `careers_url` returns 4xx/5xx persistently.
- `skip_probe:no_embed` — page renders 200 but no ATS embed found
  (custom HTML, JS-rendered, or marketing page).
- `manual_check` — ambiguous case (5xx, timeout, redirected).
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import os
import re
from dataclasses import dataclass
from pathlib import Path

from ..db import connect
from ..http import RateLimitedClient

# Supported ATSes (matching `discovery.py` patterns; if these match, the
# row should already be producing jobs — flag for adapter / discovery
# debugging).
SUPPORTED_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("greenhouse", re.compile(r"boards(?:-api)?\.greenhouse\.io/(?:v\d+/boards/)?(?P<slug>[a-z0-9-]+)", re.I)),
    ("greenhouse", re.compile(r"(?<![\w-])(?!boards-api|boards|api|app|www|jobs|talent|careers)(?P<slug>[a-z0-9-]+)\.greenhouse\.io", re.I)),
    ("lever", re.compile(r"jobs\.lever\.co/(?P<slug>[a-z0-9-]+)", re.I)),
    ("ashby", re.compile(r"jobs\.ashbyhq\.com/(?P<slug>[a-z0-9-]+)", re.I)),
    ("workable", re.compile(r"apply\.workable\.com/(?P<slug>[a-z0-9-]+)", re.I)),
    ("personio", re.compile(r"(?P<slug>[a-z0-9-]+)\.jobs\.personio\.(?:de|com)", re.I)),
    ("recruitee", re.compile(r"(?P<slug>[a-z0-9-]+)\.recruitee\.com", re.I)),
]

# Unsupported ATSes — drives the adapter-expansion backlog. Pattern hits
# count toward the ≥3-VC threshold for justifying a new adapter.
UNSUPPORTED_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("workday", re.compile(r"(?P<slug>[a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com", re.I)),
    ("workday", re.compile(r"myworkdayjobs\.com/(?P<slug>[a-z0-9-]+)", re.I)),
    ("smartrecruiters", re.compile(r"(?:careers|jobs)\.smartrecruiters\.com/(?P<slug>[a-z0-9_-]+)", re.I)),
    ("smartrecruiters", re.compile(r"api\.smartrecruiters\.com/v\d+/companies/(?P<slug>[a-z0-9_-]+)", re.I)),
    ("teamtailor", re.compile(r"(?P<slug>[a-z0-9-]+)\.teamtailor\.com", re.I)),
    ("bamboohr", re.compile(r"(?P<slug>[a-z0-9-]+)\.bamboohr\.com/(?:jobs|careers)", re.I)),
    ("zoho", re.compile(r"zoho\.(?:com|eu)/recruit/(?P<slug>[a-z0-9-]+)", re.I)),
    ("join", re.compile(r"join\.com/companies/(?P<slug>[a-z0-9-]+)", re.I)),
    ("jazzhr", re.compile(r"(?P<slug>[a-z0-9-]+)\.applytojob\.com", re.I)),
    ("wellfound", re.compile(r"(?:wellfound|angel)\.co/(?:company|jobs)/(?P<slug>[a-z0-9-]+)", re.I)),
    ("rippling", re.compile(r"ats\.rippling\.com/(?P<slug>[a-z0-9-]+)", re.I)),
    ("breezy", re.compile(r"(?P<slug>[a-z0-9-]+)\.breezy\.hr", re.I)),
    ("jobvite", re.compile(r"jobs\.jobvite\.com/(?P<slug>[a-z0-9-]+)", re.I)),
    ("icims", re.compile(r"(?P<slug>[a-z0-9-]+)\.icims\.com", re.I)),
    ("paylocity", re.compile(r"recruiting\.paylocity\.com/.*?/(?P<slug>[a-z0-9-]+)", re.I)),
    ("notion", re.compile(r"(?P<slug>[a-z0-9-]+)\.notion\.site", re.I)),
]
# NOTE: LinkedIn intentionally NOT in UNSUPPORTED_PATTERNS — almost every
# careers page has a `linkedin.com/company/X` social link in the footer,
# which would falsely shadow real ATS embeds further down the HTML.


@dataclass
class ProbeResult:
    domain: str
    name: str
    careers_url: str
    http_status: int | str
    ats_provider: str
    ats_slug: str
    ats_supported: bool
    recommendation: str
    notes: str


async def probe_one(
    client: RateLimitedClient, domain: str, name: str, careers_url: str | None
) -> ProbeResult:
    if not careers_url:
        return ProbeResult(
            domain=domain,
            name=name,
            careers_url="",
            http_status="",
            ats_provider="",
            ats_slug="",
            ats_supported=False,
            recommendation="skip_probe:no_careers_url",
            notes="",
        )

    try:
        resp = await client.get(careers_url, follow_redirects=True)
    except Exception as exc:
        return ProbeResult(
            domain=domain,
            name=name,
            careers_url=careers_url,
            http_status="error",
            ats_provider="",
            ats_slug="",
            ats_supported=False,
            recommendation="manual_check",
            notes=type(exc).__name__,
        )

    status = resp.status_code
    if status >= 400:
        rec = "skip_probe:dead_url" if status in (404, 410) else "manual_check"
        return ProbeResult(
            domain=domain,
            name=name,
            careers_url=careers_url,
            http_status=status,
            ats_provider="",
            ats_slug="",
            ats_supported=False,
            recommendation=rec,
            notes=f"HTTP {status}",
        )

    text = resp.text or ""

    for provider, pattern in SUPPORTED_PATTERNS:
        m = pattern.search(text)
        if m:
            return ProbeResult(
                domain=domain,
                name=name,
                careers_url=careers_url,
                http_status=status,
                ats_provider=provider,
                ats_slug=m.group("slug").lower(),
                ats_supported=True,
                recommendation="fix_supported_ats",
                notes="discovery returned None despite live embed",
            )

    for provider, pattern in UNSUPPORTED_PATTERNS:
        m = pattern.search(text)
        if m:
            return ProbeResult(
                domain=domain,
                name=name,
                careers_url=careers_url,
                http_status=status,
                ats_provider=provider,
                ats_slug=m.group("slug").lower(),
                ats_supported=False,
                recommendation=f"add_adapter:{provider}",
                notes="",
            )

    return ProbeResult(
        domain=domain,
        name=name,
        careers_url=careers_url,
        http_status=status,
        ats_provider="",
        ats_slug="",
        ats_supported=False,
        recommendation="skip_probe:no_embed",
        notes="page 200 but no ATS pattern matched",
    )


async def run_audit(out_path: Path, concurrency: int = 8) -> list[ProbeResult]:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select v.domain, v.name, v.careers_url
            from vcs v
            where v.skip_probe = false
              and (
                select count(*) from jobs j
                where j.company_domain = v.domain
                  and j.is_active = true
              ) = 0
            order by v.name
            """
        )
        rows = cur.fetchall()

    print(f"Probing {len(rows)} zero-job VCs (concurrency={concurrency})...")
    sem = asyncio.Semaphore(concurrency)

    async with RateLimitedClient() as client:
        async def _bound(domain: str, name: str, url: str | None) -> ProbeResult:
            async with sem:
                r = await probe_one(client, domain, name, url)
                print(f"  {r.recommendation:30s}  {domain[:30]:30s}  {r.ats_provider}/{r.ats_slug}")
                return r

        results = await asyncio.gather(
            *(_bound(d, n, u) for (d, n, u) in rows)
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "domain",
                "name",
                "careers_url",
                "http_status",
                "ats_provider",
                "ats_slug",
                "ats_supported",
                "recommendation",
                "notes",
            ]
        )
        for r in results:
            w.writerow(
                [
                    r.domain,
                    r.name,
                    r.careers_url,
                    r.http_status,
                    r.ats_provider,
                    r.ats_slug,
                    r.ats_supported,
                    r.recommendation,
                    r.notes,
                ]
            )
    print(f"\nWrote {out_path} ({len(results)} rows)")
    return results


def summarize(results: list[ProbeResult]) -> None:
    by_rec: dict[str, int] = {}
    by_provider: dict[str, int] = {}
    for r in results:
        by_rec[r.recommendation] = by_rec.get(r.recommendation, 0) + 1
        if r.ats_provider:
            by_provider[r.ats_provider] = by_provider.get(r.ats_provider, 0) + 1

    print("\n=== Recommendations ===")
    for rec, n in sorted(by_rec.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {rec}")

    print("\n=== ATS providers detected ===")
    for prov, n in sorted(by_provider.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {prov}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit zero-job VC adapters")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output CSV path (default: audit/vc_adapter_audit-<ts>.csv)",
    )
    parser.add_argument("--concurrency", type=int, default=8)
    args = parser.parse_args()

    if args.out is None:
        ts = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
        args.out = Path("audit") / f"vc_adapter_audit-{ts}.csv"

    results = asyncio.run(run_audit(args.out, concurrency=args.concurrency))
    summarize(results)


if __name__ == "__main__":
    main()
