"""Workable public job-board adapter.

Endpoint:  https://apply.workable.com/api/v3/accounts/<slug>/jobs (POST, paginated)
Detection: ``apply.workable.com/<slug>`` patterns.
Auth:      none.

Workable's public listing endpoint is a POST that returns a page of results plus
a ``nextPage`` token. v0 of this adapter pulls the first page only; pagination
is added when a real account exceeds 100 roles.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, cast
from urllib.parse import urlparse

import httpx

from ..models import AtsSource, CanonicalJob
from .base import USER_AGENT

WORKABLE_API = "https://apply.workable.com/api/v3/accounts/{slug}/jobs"
SLUG_PATTERN = re.compile(r"apply\.workable\.com/(?P<slug>[a-z0-9-]+)", re.I)


class WorkableAdapter:
    source: AtsSource = AtsSource.WORKABLE

    def detect(self, careers_url: str) -> str | None:
        host_and_path = urlparse(careers_url).netloc + urlparse(careers_url).path
        match = SLUG_PATTERN.search(host_and_path)
        return match.group("slug").lower() if match else None

    async def fetch(self, slug: str, client: httpx.AsyncClient) -> list[dict[str, object]]:
        url = WORKABLE_API.format(slug=slug)
        resp = await client.post(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            json={"limit": 100},
        )
        resp.raise_for_status()
        payload = cast(dict[str, Any], resp.json())
        results = payload.get("results", [])
        return list(results) if isinstance(results, list) else []

    def normalize(
        self,
        raw: dict[str, object],
        company_name: str,
        company_domain: str,
    ) -> CanonicalJob:
        title = str(raw.get("title", "")).strip()
        url = str(raw.get("url") or raw.get("application_url") or "")
        location_obj = raw.get("location")
        location = ""
        if isinstance(location_obj, dict):
            city = str(location_obj.get("city", ""))
            country = str(location_obj.get("country", ""))
            location = ", ".join(part for part in (city, country) if part)
        is_remote = bool(raw.get("remote"))
        employment_type = str(raw.get("employment_type")) if raw.get("employment_type") else None
        published_raw = raw.get("published")
        posted_date = _parse_iso_date(published_raw if isinstance(published_raw, str) else None)
        return CanonicalJob(
            company_name=company_name,
            company_domain=company_domain,
            role_title=title,
            location=location or None,
            is_remote=is_remote,
            employment_type=employment_type,
            url=url,  # type: ignore[arg-type]
            posted_date=posted_date,
            ats_source=self.source,
            raw_payload=cast(dict[str, Any], raw),
        )


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None
