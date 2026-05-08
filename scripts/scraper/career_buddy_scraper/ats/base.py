"""Adapter protocol shared by every ATS implementation."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import httpx

from ..models import AtsSource, CanonicalJob


@runtime_checkable
class AtsAdapter(Protocol):
    """Detect / fetch / normalize contract for a single ATS provider."""

    source: AtsSource

    def detect(self, careers_url: str) -> str | None:
        """Return the ATS slug if ``careers_url`` belongs to this provider, else None."""

    async def fetch(self, slug: str, client: httpx.AsyncClient) -> list[dict[str, object]]:
        """Pull all open postings for ``slug`` from the provider's public API."""

    def normalize(
        self,
        raw: dict[str, object],
        company_name: str,
        company_domain: str,
    ) -> CanonicalJob:
        """Map one raw posting onto the ``CanonicalJob`` schema."""


USER_AGENT = "Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)"
DEFAULT_TIMEOUT_S = 15.0
DEFAULT_PER_HOST_DELAY_S = 0.2
DEFAULT_PER_PROVIDER_CONCURRENCY = 5
