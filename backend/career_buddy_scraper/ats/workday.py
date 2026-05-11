"""Workday public job-board adapter (enterprise, biggest unsupported gap).

Endpoint:  POST https://<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site_id>/jobs
Detection: ``<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site_id>`` URLs.
Auth:      none.

The slug we hand the orchestrator is a **compound** of three pieces:
``<tenant>/<wd_num>/<site_id>`` (e.g. ``intel/wd1/external``). Workday
tenants live on regional shards (wd1 = US, wd3 = EU, wd5 = another
region) and the same ``<tenant>`` host on a different wd-shard is a
different board, so the shard has to round-trip with the slug.

Pagination is offset-based (unlike workable's token-based). Each page
returns at most 20 jobs by default; we ask for ``limit=20`` explicitly
and walk ``offset`` until we've seen the reported ``total`` or hit the
``MAX_PAGES`` cap.

Job-detail URL is reconstructed from the per-row ``externalPath`` and
the slug: ``https://<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site_id><externalPath>``.
``lang`` defaults to ``en-US`` (the dominant external-careers
localisation; we don't try to resolve the original locale from the
seed URL because the same posting is reachable on every locale URL).
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, cast
from urllib.parse import urlparse

from ..http import RateLimitedClient
from ..models import AtsSource

WORKDAY_API = (
    "https://{tenant}.{wd_num}.myworkdayjobs.com/wday/cxs/{tenant}/{site_id}/jobs"
)
WORKDAY_URL_PREFIX = "https://{tenant}.{wd_num}.myworkdayjobs.com/{lang}/{site_id}"
DEFAULT_LANG = "en-US"
PAGE_SIZE = 20
MAX_PAGES = 200  # 200 × 20 = 4000 postings — NVIDIA alone has 2000

# Captures tenant, wd-shard, site_id from the user-facing Workday URL.
# Tolerant of optional locale segment (``en-US``, ``de-DE``) and trailing
# slash. Site_id may include underscores + mixed case
# (``External_Career_Site``, ``NVIDIAExternalCareerSite``).
URL_PATTERN = re.compile(
    r"(?P<tenant>[a-z0-9-]+)\.(?P<wd_num>wd\d+)\.myworkdayjobs\.com"
    r"(?:/[a-z]{2}-[A-Z]{2})?"
    r"(?:/(?P<site_id>[A-Za-z0-9_-]+))?",
    re.I,
)


def _split_slug(slug: str) -> tuple[str, str, str]:
    parts = slug.split("/")
    if len(parts) != 3:
        raise ValueError(
            f"workday slug must be <tenant>/<wd_num>/<site_id>, got {slug!r}"
        )
    return parts[0], parts[1], parts[2]


class WorkdayAdapter:
    source: AtsSource = AtsSource.WORKDAY

    def detect(self, careers_url: str) -> str | None:
        host_and_path = urlparse(careers_url).netloc + urlparse(careers_url).path
        match = URL_PATTERN.search(host_and_path)
        if not match:
            return None
        site_id = match.group("site_id")
        if not site_id:
            # No site_id in URL — we can't fetch without one. Skip rather
            # than guess (different tenants use different defaults:
            # ``External``, ``External_Career_Site``, etc.).
            return None
        tenant = match.group("tenant").lower()
        wd_num = match.group("wd_num").lower()
        return f"{tenant}/{wd_num}/{site_id}"

    async def fetch(self, slug: str, client: RateLimitedClient) -> list[dict[str, Any]]:
        tenant, wd_num, site_id = _split_slug(slug)
        url = WORKDAY_API.format(tenant=tenant, wd_num=wd_num, site_id=site_id)
        results: list[dict[str, Any]] = []
        offset = 0
        total: int | None = None
        for _ in range(MAX_PAGES):
            body = {
                "limit": PAGE_SIZE,
                "offset": offset,
                "appliedFacets": {},
                "searchText": "",
            }
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            payload = cast(dict[str, Any], resp.json())
            postings = payload.get("jobPostings", [])
            if not isinstance(postings, list):
                break
            if total is None and isinstance(payload.get("total"), int):
                total = payload["total"]
            for posting in postings:
                if isinstance(posting, dict):
                    posting["_workday_slug"] = slug
                    results.append(posting)
            if not postings:
                break
            offset += len(postings)
            if total is not None and offset >= total:
                break
        return results

    def normalize(
        self,
        raw: dict[str, Any],
        company_name: str,
        company_domain: str,
    ) -> dict[str, Any]:
        title = str(raw.get("title", "")).strip()
        external_path = str(raw.get("externalPath") or "")
        slug = raw.get("_workday_slug") or ""
        url = ""
        if external_path and slug:
            try:
                tenant, wd_num, site_id = _split_slug(str(slug))
                prefix = WORKDAY_URL_PREFIX.format(
                    tenant=tenant, wd_num=wd_num, lang=DEFAULT_LANG, site_id=site_id
                )
                url = prefix + external_path
            except ValueError:
                url = ""
        location_text = raw.get("locationsText")
        location: str | None = None
        if isinstance(location_text, str):
            cleaned = location_text.strip()
            if cleaned and not cleaned.lower().endswith("locations"):
                location = cleaned
        posted_date = _parse_posted_on(raw.get("postedOn"))
        return {
            "company_name": company_name,
            "company_domain": company_domain,
            "role_title": title,
            "location": location,
            "is_remote": False,  # Workday API has no remote flag; would
            # need locationsText heuristics — out of scope for v1.
            "employment_type": None,
            "url": url,
            "posted_date": posted_date,
            "ats_source": self.source.value,
            "raw_payload": raw,
        }


_POSTED_RELATIVE = re.compile(r"(?P<n>\d+)\+?\s+(?P<unit>day|days|month|months)", re.I)


def _parse_posted_on(value: Any) -> date | None:
    """Workday returns relative strings like ``Posted 5 Days Ago``.

    Best-effort conversion to an absolute date assuming today as the
    reference. Returns None for unknown / ``Posted Today`` patterns
    (caller treats None as "no posted_date").
    """
    if not isinstance(value, str):
        return None
    text = value.strip().lower()
    if not text:
        return None
    if "today" in text:
        return datetime.utcnow().date()
    if "yesterday" in text:
        return (datetime.utcnow() - timedelta(days=1)).date()
    match = _POSTED_RELATIVE.search(text)
    if match is None:
        return None
    n = int(match.group("n"))
    unit = match.group("unit").lower()
    if unit.startswith("day"):
        delta = timedelta(days=n)
    elif unit.startswith("month"):
        delta = timedelta(days=n * 30)
    else:
        return None
    return (datetime.utcnow() - delta).date()
