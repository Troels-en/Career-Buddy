"""VC master list builder (Phase A).

Pulls VC firm records from public aggregators, dedupes by registered domain,
and persists the result to ``data/vc_master_list.json``.

Sources for v0.1:

- **OpenVC** — free CSV export at https://www.openvc.app/. Manually placed at
  ``data/sources/openvc.csv`` for v0.1; Phase A.1 adds an automated fetcher.
- **EU-Startups directory** — scraped HTML; deferred until openvc.csv is in.
- **Notion seed** — pre-classified Tier-1 VCs (Cherry, Picus, Earlybird, etc.)
  exported from the Karriere workspace.

This module is the *deduper + classifier*, not the *fetcher*. Each source
produces an iterable of ``VcRecord`` candidates; ``merge`` collapses them.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path

import tldextract

from .models import VcRecord


def normalize_domain(raw: str) -> str:
    """Reduce ``raw`` to its registered domain, lowercase, no scheme/path."""
    extracted = tldextract.extract(raw.strip())
    top = extracted.top_domain_under_public_suffix
    if not top:
        return raw.strip().lower()
    return top.lower()


def merge(candidates: Iterable[VcRecord]) -> list[VcRecord]:
    """Collapse multiple records per domain into one, preferring populated fields."""
    by_domain: dict[str, VcRecord] = {}
    for cand in candidates:
        key = normalize_domain(cand.domain)
        cand = cand.model_copy(update={"domain": key})
        existing = by_domain.get(key)
        if existing is None:
            by_domain[key] = cand
            continue
        merged_fields: dict[str, object] = {}
        for field_name in VcRecord.model_fields:
            existing_value = getattr(existing, field_name)
            cand_value = getattr(cand, field_name)
            if not existing_value and cand_value:
                merged_fields[field_name] = cand_value
            elif field_name == "sources":
                combined = sorted({*existing.sources, *cand.sources})
                merged_fields[field_name] = combined
            elif field_name == "sector_tags":
                combined = sorted({*existing.sector_tags, *cand.sector_tags})
                merged_fields[field_name] = combined
        if merged_fields:
            by_domain[key] = existing.model_copy(update=merged_fields)
    return sorted(by_domain.values(), key=lambda v: v.domain)


def write(records: list[VcRecord], path: Path) -> None:
    """Persist ``records`` as a deterministic JSON list."""
    serialised = [r.model_dump(mode="json", exclude_none=False) for r in records]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(serialised, indent=2, sort_keys=True) + "\n", encoding="utf-8")
