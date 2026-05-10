"""Extract plain-text ``description`` and ``requirements`` from raw ATS payloads.

Three ATS sources covered: greenhouse, lever, ashby. The raw_payload jsonb
already contains the full job-description content because the scraper called
each list endpoint with content=true / mode=json. The original normalize()
discarded those fields; this module recovers them.

Outputs are plain text:
- description: full JD body (max ~10 KB).
- requirements: only the "Requirements" / "Qualifications" / "Was du mitbringst"
  section, when one can be detected. Empty string if not detectable.
"""

from __future__ import annotations

import html
import re
from typing import Any

from selectolax.parser import HTMLParser

DESCRIPTION_LIMIT = 30_000
REQUIREMENTS_LIMIT = 5_000

# Anchored heading regex — EN + DE + FR. Matched on plain-text lines.
_HEADING_OR = (
    # English
    r"requirements?|qualifications?|"
    r"what\s+you(?:'|’)?ll\s+bring|what\s+you\s+bring|"
    r"what\s+we(?:'|’)?re\s+looking\s+for|what\s+we\s+look\s+for|"
    r"about\s+you|your\s+profile|your\s+skills|who\s+you\s+are|"
    r"you\s+have|you(?:'|’)?ll\s+have|"
    r"must[-\s]?haves?|skills\s+\&\s+experience|required\s+experience|"
    # German
    r"anforderungen|qualifikationen|dein\s+profil|ihr\s+profil|"
    r"was\s+du\s+mitbringst|was\s+sie\s+mitbringen|das\s+bringst\s+du\s+mit|"
    r"deine\s+qualifikationen|ihre\s+qualifikationen|"
    r"erforderliche\s+kenntnisse|voraussetzungen|du\s+bist|du\s+hast|"
    # French
    r"profil\s+recherché|votre\s+profil|compétences\s+requises|compétences|"
    r"exigences|ce\s+que\s+nous\s+recherchons|qui\s+vous\s+êtes"
)
_BREAK_OR = (
    # English
    r"benefits|perks|compensation|salary|"
    r"we\s+offer|what\s+we\s+offer|what\s+you(?:'|’)?ll\s+get|what\s+you\s+get|"
    r"why\s+join|why\s+us|our\s+process|interview\s+process|next\s+steps|"
    r"about\s+(?:us|the\s+company)|diversity|equal\s+opportunity|eeo|"
    # German
    r"wir\s+bieten|unser\s+angebot|vorteile|warum\s+wir|über\s+uns|interesse|"
    # French
    r"avantages|nous\s+offrons|à\s+propos|notre\s+processus|pourquoi\s+nous"
)

# Heading lines are short, may have leading bullet/emoji/markdown-#, optional trailing colon.
_HEADING_LINE_RE = re.compile(
    rf"(?im)^[\s#*•▪️🔍🌟✨🚀🎯💡🔧🛠️📋\-‣◦⁃∙]*\W{{0,3}}"
    rf"({_HEADING_OR})\W{{0,5}}\s*[:.\-—–]?\s*$"
)
_BREAK_LINE_RE = re.compile(
    rf"(?im)^[\s#*•▪️🔍🌟✨🚀🎯💡🔧🛠️📋\-‣◦⁃∙]*\W{{0,3}}"
    rf"({_BREAK_OR})\W{{0,5}}\s*[:.\-—–]?\s*$"
)


def _html_to_text(html_blob: str) -> str:
    """Convert an HTML (or HTML-escaped) blob to clean plain text.

    Handles double-escaping (Greenhouse) by unescaping until stable, capped at
    3 iterations to avoid pathological inputs.
    """
    if not html_blob:
        return ""
    text = html_blob
    for _ in range(3):
        new = html.unescape(text)
        if new == text:
            break
        text = new
    # Strip HTML tags via selectolax (separator preserves block boundaries).
    if "<" in text and ">" in text:
        try:
            parsed = HTMLParser(text)
            if parsed.body:
                text = parsed.body.text(separator="\n")
        except Exception:
            pass
    # Normalize: NBSP → space, zero-width chars → drop.
    text = text.replace("\xa0", " ").replace("​", "").replace(" ", "\n")
    # Collapse runs of horizontal whitespace, preserve newlines.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _find_requirements_section(text: str) -> str:
    """Locate the requirements heading and return content until the next section.

    Returns empty string if no heading found.
    """
    if not text:
        return ""
    head = _HEADING_LINE_RE.search(text)
    if not head:
        return ""
    start = head.end()
    rest = text[start:]
    # Look for next section break.
    brk = _BREAK_LINE_RE.search(rest)
    if brk:
        body = rest[: brk.start()]
    else:
        # No explicit break — take next ~30 lines.
        lines = rest.splitlines()
        body = "\n".join(lines[:30])
    return body.strip()


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def extract_greenhouse(raw_payload: dict[str, Any]) -> tuple[str, str]:
    """Greenhouse: ``content`` is HTML-escaped HTML."""
    content = str(raw_payload.get("content") or "")
    description = _html_to_text(content)
    requirements = _find_requirements_section(description)
    return _truncate(description, DESCRIPTION_LIMIT), _truncate(
        requirements, REQUIREMENTS_LIMIT
    )


def extract_lever(raw_payload: dict[str, Any]) -> tuple[str, str]:
    """Lever: descriptionPlain + additionalPlain + structured ``lists``."""
    parts: list[str] = []
    desc_plain = str(raw_payload.get("descriptionPlain") or raw_payload.get("descriptionBodyPlain") or "")
    if desc_plain:
        parts.append(desc_plain.strip())

    # Embed structured lists into description (one block per section).
    lists = raw_payload.get("lists")
    list_blocks: list[str] = []
    requirements_block = ""
    if isinstance(lists, list):
        head_re = re.compile(_HEADING_OR, re.I)
        for lst in lists:
            if not isinstance(lst, dict):
                continue
            heading = str(lst.get("text") or "").strip()
            content_html = str(lst.get("content") or "")
            content_text = _html_to_text(content_html)
            if not content_text:
                continue
            block = f"{heading}\n{content_text}".strip()
            list_blocks.append(block)
            if heading and head_re.search(heading) and not requirements_block:
                requirements_block = content_text

    if list_blocks:
        parts.append("\n\n".join(list_blocks))

    additional = str(raw_payload.get("additionalPlain") or "")
    if additional:
        parts.append(additional.strip())

    description = "\n\n".join(p for p in parts if p).strip()
    requirements = requirements_block or _find_requirements_section(description)
    return _truncate(description, DESCRIPTION_LIMIT), _truncate(
        requirements, REQUIREMENTS_LIMIT
    )


def extract_ashby(raw_payload: dict[str, Any]) -> tuple[str, str]:
    """Ashby: ``descriptionPlain`` already clean."""
    description = str(raw_payload.get("descriptionPlain") or "").strip()
    if not description:
        # Fallback to descriptionHtml if plain missing.
        description = _html_to_text(str(raw_payload.get("descriptionHtml") or ""))
    requirements = _find_requirements_section(description)
    return _truncate(description, DESCRIPTION_LIMIT), _truncate(
        requirements, REQUIREMENTS_LIMIT
    )


EXTRACTORS = {
    "greenhouse": extract_greenhouse,
    "lever": extract_lever,
    "ashby": extract_ashby,
}


def extract(ats_source: str, raw_payload: dict[str, Any] | None) -> tuple[str, str]:
    """Dispatch to the right extractor, return ('','') for unsupported sources.

    Extractor exceptions are NOT swallowed — the CLI catches them per-row so
    real failures show up in the ``errored`` counter instead of being hidden
    as ``skipped_no_description``.
    """
    if not raw_payload or not isinstance(raw_payload, dict):
        return "", ""
    fn = EXTRACTORS.get(ats_source)
    if fn is None:
        return "", ""
    return fn(raw_payload)
