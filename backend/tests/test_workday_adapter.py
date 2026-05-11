"""Workday adapter unit tests.

Coverage:
- detect() round-trip from a user-facing Workday URL → compound slug.
- detect() rejects URLs that omit the site_id segment.
- normalize() builds the deep job-detail URL from externalPath + slug.
- normalize() of a real-shape raw payload validates against CanonicalJob.
- _parse_posted_on heuristics: today / N days / N months / unknown.
- fetch() one-page-and-stop happy path.
- fetch() walks offset until total reached.
- fetch() honours MAX_PAGES cap.
- fetch() stashes _workday_slug on every row.
- discover_ats normalises a Workday URL embedded in HTML into the
  compound slug shape the adapter expects.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import httpx
import pytest
import respx

from career_buddy_scraper.ats.workday import (
    MAX_PAGES,
    WorkdayAdapter,
    _parse_posted_on,
)
from career_buddy_scraper.discovery import discover_ats
from career_buddy_scraper.http import RateLimitedClient, TokenBucket
from career_buddy_scraper.models import AtsSource, CanonicalJob


def test_detect_extracts_compound_slug() -> None:
    out = WorkdayAdapter().detect(
        "https://intel.wd1.myworkdayjobs.com/en-US/External"
    )
    assert out == "intel/wd1/External"


def test_detect_without_locale_segment() -> None:
    out = WorkdayAdapter().detect(
        "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite"
    )
    assert out == "nvidia/wd5/NVIDIAExternalCareerSite"


def test_detect_returns_none_without_site_id() -> None:
    out = WorkdayAdapter().detect("https://intel.wd1.myworkdayjobs.com/en-US/")
    assert out is None


def test_detect_returns_none_on_unrelated_host() -> None:
    out = WorkdayAdapter().detect("https://boards.greenhouse.io/stripe")
    assert out is None


def test_normalize_builds_job_detail_url() -> None:
    raw = {
        "title": "Sr. Infrastructure Engineer – Linux OS",
        "externalPath": "/job/US-Arizona-Phoenix/Sr-Infra_JR0281914-1",
        "locationsText": "US, Arizona, Phoenix",
        "postedOn": "Posted 5 Days Ago",
        "bulletFields": ["Spotlight Job", "JR0281914"],
        "_workday_slug": "intel/wd1/External",
    }
    out = WorkdayAdapter().normalize(raw, "Intel", "intel.com")
    assert out["ats_source"] == AtsSource.WORKDAY.value
    assert out["url"] == (
        "https://intel.wd1.myworkdayjobs.com/en-US/External/job/"
        "US-Arizona-Phoenix/Sr-Infra_JR0281914-1"
    )
    assert out["location"] == "US, Arizona, Phoenix"
    assert out["role_title"].startswith("Sr. Infrastructure Engineer")
    # Round-trips into Pydantic
    CanonicalJob.model_validate(out)


def test_normalize_skips_multi_location_placeholder() -> None:
    """``3 Locations`` is a Workday UI placeholder, not a useful location."""
    raw = {
        "title": "Senior Foundry Engineer",
        "externalPath": "/job/x/y_JR1",
        "locationsText": "3 Locations",
        "_workday_slug": "intel/wd1/External",
    }
    out = WorkdayAdapter().normalize(raw, "Intel", "intel.com")
    assert out["location"] is None


def test_parse_posted_on_today() -> None:
    assert _parse_posted_on("Posted Today") == datetime.utcnow().date()


def test_parse_posted_on_days_ago() -> None:
    today = datetime.utcnow().date()
    assert _parse_posted_on("Posted 5 Days Ago") == today - timedelta(days=5)


def test_parse_posted_on_month_ago() -> None:
    today = datetime.utcnow().date()
    # 30+ days approximates "1 Month Ago" — Workday's relative grammar
    # is purposely fuzzy; we just need a non-None lower bound.
    out = _parse_posted_on("Posted 1 Month Ago")
    assert out is not None
    assert (today - out).days >= 28


def test_parse_posted_on_unparseable_returns_none() -> None:
    assert _parse_posted_on("Posted in a galaxy far far away") is None
    assert _parse_posted_on(None) is None  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_fetch_one_page_total_known() -> None:
    async with respx.mock(assert_all_called=False) as router:
        router.post(
            "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs"
        ).respond(
            200,
            json={
                "total": 2,
                "jobPostings": [
                    {"title": "A", "externalPath": "/job/a", "locationsText": "X"},
                    {"title": "B", "externalPath": "/job/b", "locationsText": "Y"},
                ],
            },
        )
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                client=inner,
            )
            rows = await WorkdayAdapter().fetch("intel/wd1/External", client)
    assert len(rows) == 2
    assert all(r["_workday_slug"] == "intel/wd1/External" for r in rows)


@pytest.mark.asyncio
async def test_fetch_paginates_until_total_reached() -> None:
    state = {"calls": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        state["calls"] += 1
        # 25 total; page size 20 → 2 pages.
        if state["calls"] == 1:
            postings = [
                {"title": f"P1-{i}", "externalPath": f"/job/p1-{i}"}
                for i in range(20)
            ]
            return httpx.Response(200, json={"total": 25, "jobPostings": postings})
        postings = [
            {"title": f"P2-{i}", "externalPath": f"/job/p2-{i}"}
            for i in range(5)
        ]
        return httpx.Response(200, json={"total": 25, "jobPostings": postings})

    async with respx.mock(assert_all_called=False) as router:
        router.post(
            "https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/External/jobs"
        ).mock(side_effect=handler)
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                client=inner,
            )
            rows = await WorkdayAdapter().fetch("acme/wd3/External", client)
    assert state["calls"] == 2
    assert len(rows) == 25


@pytest.mark.asyncio
async def test_fetch_caps_at_max_pages() -> None:
    state = {"calls": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        state["calls"] += 1
        return httpx.Response(
            200,
            json={
                "total": 100_000,  # huge — would loop forever without cap
                "jobPostings": [
                    {"title": f"X-{state['calls']}-{i}", "externalPath": f"/job/x{i}"}
                    for i in range(20)
                ],
            },
        )

    async with respx.mock(assert_all_called=False) as router:
        router.post(
            "https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/External/jobs"
        ).mock(side_effect=handler)
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                client=inner,
            )
            rows = await WorkdayAdapter().fetch("acme/wd3/External", client)
    assert state["calls"] == MAX_PAGES
    assert len(rows) == MAX_PAGES * 20


@pytest.mark.asyncio
async def test_fetch_empty_page_stops() -> None:
    async with respx.mock(assert_all_called=False) as router:
        router.post(
            "https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/External/jobs"
        ).respond(200, json={"total": 0, "jobPostings": []})
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                client=inner,
            )
            rows = await WorkdayAdapter().fetch("acme/wd3/External", client)
    assert rows == []


@pytest.mark.asyncio
async def test_discover_ats_normalises_workday_embed() -> None:
    """Page HTML that mentions a Workday board surfaces a compound slug."""
    page = """
        <html><body>
          <a href="https://intel.wd1.myworkdayjobs.com/en-US/External">
            Open roles
          </a>
        </body></html>
    """
    async with respx.mock(assert_all_called=False) as router:
        router.get("https://intel.com/careers").respond(200, html=page)
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                client=inner,
            )
            out = await discover_ats("https://intel.com/careers", client)
    assert out == ("workday", "intel/wd1/External")
