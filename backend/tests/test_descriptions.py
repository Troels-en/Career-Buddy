"""Unit tests for descriptions extractors. Pure pure-function tests."""

from __future__ import annotations

from career_buddy_scraper.descriptions import (
    DESCRIPTION_LIMIT,
    REQUIREMENTS_LIMIT,
    extract,
    extract_ashby,
    extract_greenhouse,
    extract_lever,
)

GREENHOUSE_HAPPY = {
    "title": "Founders Associate",
    "content": (
        "&lt;p&gt;We are a fast-growing AI startup.&lt;/p&gt;"
        "&lt;p&gt;&lt;strong&gt;Requirements&lt;/strong&gt;&lt;/p&gt;"
        "&lt;ul&gt;&lt;li&gt;3+ years operator experience&lt;/li&gt;"
        "&lt;li&gt;B2B SaaS exposure&lt;/li&gt;&lt;/ul&gt;"
        "&lt;p&gt;&lt;strong&gt;Benefits&lt;/strong&gt;&lt;/p&gt;"
        "&lt;p&gt;Equity, lunch, etc.&lt;/p&gt;"
    ),
}

LEVER_HAPPY = {
    "text": "BizOps Lead",
    "descriptionPlain": "We connect data, people, and processes.",
    "additionalPlain": "Apply at the link below.",
    "lists": [
        {
            "text": "What you'll do",
            "content": "<ul><li>Run weekly business reviews</li><li>Build dashboards</li></ul>",
        },
        {
            "text": "Requirements",
            "content": "<ul><li>5+ years analytics</li><li>SQL fluency</li></ul>",
        },
    ],
}

ASHBY_HAPPY = {
    "title": "Strategy Associate",
    "descriptionPlain": (
        "About the role.\n\n"
        "Anforderungen\n\n"
        "- 2+ Jahre Beratungserfahrung\n"
        "- Fließendes Deutsch\n\n"
        "Wir bieten\n\n"
        "- Bonus\n- Hybrid\n"
    ),
}


def test_greenhouse_happy_extracts_description_and_requirements() -> None:
    desc, reqs = extract_greenhouse(GREENHOUSE_HAPPY)
    assert "fast-growing AI startup" in desc
    assert "Equity, lunch" in desc
    assert "3+ years operator experience" in reqs
    assert "Equity, lunch" not in reqs  # benefits cuts requirements off


def test_lever_lists_in_description_and_requirements_only_from_matching_section() -> None:
    desc, reqs = extract_lever(LEVER_HAPPY)
    # description should contain BOTH list sections, not just plain
    assert "Run weekly business reviews" in desc
    assert "5+ years analytics" in desc
    # requirements should only contain the Requirements list
    assert "5+ years analytics" in reqs
    assert "Run weekly business reviews" not in reqs


def test_ashby_german_anforderungen_heading() -> None:
    desc, reqs = extract_ashby(ASHBY_HAPPY)
    assert "About the role" in desc
    assert "2+ Jahre Beratungserfahrung" in reqs
    assert "Bonus" not in reqs  # cut by "Wir bieten"


def test_dispatch_extract_returns_empty_for_unsupported_source() -> None:
    desc, reqs = extract("workable", {"description": "<p>x</p>"})
    assert desc == "" and reqs == ""


def test_dispatch_extract_returns_empty_for_none_payload() -> None:
    desc, reqs = extract("greenhouse", None)
    assert desc == "" and reqs == ""


def test_dispatch_extract_returns_empty_for_empty_dict() -> None:
    desc, _reqs = extract("greenhouse", {})
    assert desc == ""


def test_lever_with_empty_lists_falls_back_to_description_plain() -> None:
    payload = {
        "text": "Marketing",
        "descriptionPlain": "Marketing role at our company.",
        "lists": [],
    }
    desc, reqs = extract_lever(payload)
    assert "Marketing role" in desc
    assert reqs == ""


def test_greenhouse_no_html_tags_still_extracts() -> None:
    payload = {
        "title": "Account Manager",
        "content": "Account management role.\n\nRequirements\n\n- 2 years SaaS\n- B2B sales",
    }
    desc, reqs = extract_greenhouse(payload)
    assert "Account management role" in desc
    assert "2 years SaaS" in reqs


def test_ashby_no_requirements_section_returns_empty_requirements() -> None:
    payload = {"title": "Junior PM", "descriptionPlain": "Just a job description with no headings at all, just prose."}
    desc, reqs = extract_ashby(payload)
    assert "no headings" in desc
    assert reqs == ""


def test_truncation_at_description_limit() -> None:
    # Build a description longer than DESCRIPTION_LIMIT.
    long_text = "x" * (DESCRIPTION_LIMIT + 5_000)
    payload = {"title": "x", "descriptionPlain": long_text}
    desc, _ = extract_ashby(payload)
    assert len(desc) <= DESCRIPTION_LIMIT
    assert desc.endswith("…")


def test_truncation_at_requirements_limit() -> None:
    # Single long bullet line forces requirements past the 5KB cap.
    long_bullet = "- " + "x" * (REQUIREMENTS_LIMIT + 2_000) + "\n"
    long_req = "Anforderungen\n\n" + long_bullet
    payload = {"title": "x", "descriptionPlain": long_req}
    _, reqs = extract_ashby(payload)
    assert len(reqs) <= REQUIREMENTS_LIMIT
    assert reqs.endswith("…")


def test_french_profil_recherche_heading() -> None:
    payload = {
        "title": "Stage",
        "descriptionPlain": "Description du poste.\n\nProfil recherché\n\n- Master en finance\n- Anglais courant\n\nAvantages\n\n- TR\n",
    }
    _desc, reqs = extract_ashby(payload)
    assert "Master en finance" in reqs
    assert "TR" not in reqs


def test_double_escaped_greenhouse_html_is_decoded() -> None:
    payload = {
        "title": "Ops",
        "content": "&amp;lt;p&amp;gt;Hello&amp;lt;/p&amp;gt;&amp;lt;p&amp;gt;Requirements&amp;lt;/p&amp;gt;&amp;lt;p&amp;gt;5 years&amp;lt;/p&amp;gt;",
    }
    desc, _reqs = extract_greenhouse(payload)
    assert "Hello" in desc
    assert "Requirements" in desc
    # heading detection on aggressive double-escape can be fragile; ensure
    # description at least round-trips through unescape.
    assert "&lt;" not in desc
    assert "&amp;" not in desc
