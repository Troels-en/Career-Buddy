"""Role categorization (Phase D).

Tier 1 — high-precision regex over the role title.
Tier 2 — LLM classifier over title + first 500 chars of description (deferred,
         only fills rows where Tier-1 returned None).

Tier-2 plumbing lives elsewhere; this module owns the deterministic Tier-1
filter so it stays test-covered and dependency-free.
"""

from __future__ import annotations

import re

from .models import RoleCategory

TIER1_PATTERNS: list[tuple[re.Pattern[str], RoleCategory]] = [
    (
        re.compile(
            r"\b(founders?\s*associate|founder['’]?s\s*associate|special\s+projects)\b",
            re.I,
        ),
        RoleCategory.FOUNDERS_ASSOCIATE,
    ),
    (
        re.compile(r"\b(chief\s+of\s+staff|cos)\b", re.I),
        RoleCategory.CHIEF_OF_STAFF,
    ),
    (
        re.compile(
            r"\b(operating\s+associate|biz\s*ops|business\s+operations|portfolio\s+operator)\b",
            re.I,
        ),
        RoleCategory.BIZOPS,
    ),
    (
        re.compile(
            r"\b(strategy\s+associate|strategy\s*&\s*operations|strategic\s+initiatives)\b",
            re.I,
        ),
        RoleCategory.STRATEGY,
    ),
    (
        re.compile(
            r"\b(business\s+development|partnerships\s+associate)\b",
            re.I,
        ),
        RoleCategory.BD,
    ),
    (
        re.compile(
            r"\b(investment\s+(analyst|associate)|venture\s+associate)\b",
            re.I,
        ),
        RoleCategory.INVESTMENT_ANALYST,
    ),
]


def tier1_classify(title: str) -> RoleCategory | None:
    """Return the deterministic role category, or None if no pattern matches."""
    for pattern, category in TIER1_PATTERNS:
        if pattern.search(title):
            return category
    return None
