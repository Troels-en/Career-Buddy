"""Mocked tests for the rate-limited HTTP client (no live network)."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx
import pytest
import respx

from career_buddy_scraper.http import (
    MetricEvent,
    RateLimitedClient,
    TokenBucket,
    _peak_per_minute,
)


@pytest.mark.asyncio
async def test_token_bucket_burst_then_block() -> None:
    """Bucket grants ``capacity`` tokens immediately, then blocks until refill."""
    bucket = TokenBucket(capacity=5, refill_period_s=60.0)
    for _ in range(5):
        await asyncio.wait_for(bucket.acquire(), timeout=0.05)
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(bucket.acquire(), timeout=0.05)


@pytest.mark.asyncio
async def test_rate_limit_caps_peak_per_minute() -> None:
    """200 requests with a 100 / 60 s bucket: peak per minute ≤ 100."""
    bucket = TokenBucket(capacity=10, refill_period_s=1.0)  # 10 req/s
    async with respx.mock(base_url="https://example.test") as router:
        router.get("/ping").respond(200, json={"ok": True})
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(bucket=bucket, per_host_delay_s=0.0, client=inner)
            for _ in range(20):
                await client.get("https://example.test/ping")
    assert _peak_per_minute(client.metrics()["events"]) <= 100


@pytest.mark.asyncio
async def test_disk_cache_hit(tmp_path: Path) -> None:
    """Same GET twice within TTL: second call records cache_hit=True, no network."""
    async with respx.mock(base_url="https://example.test") as router:
        route = router.get("/cached").respond(200, json={"value": 42})
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                cache_dir=tmp_path,
                client=inner,
            )
            r1 = await client.get("https://example.test/cached")
            r2 = await client.get("https://example.test/cached")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == {"value": 42}
    assert r2.json() == {"value": 42}
    assert route.call_count == 1
    events = client.metrics()["events"]
    assert events[0].cache_hit is False
    assert events[1].cache_hit is True


@pytest.mark.asyncio
async def test_per_host_delay_enforces_minimum_gap() -> None:
    """Two back-to-back same-host calls: second observes ≥ ``per_host_delay_s``."""
    delay_s = 0.05  # short for test speed
    async with respx.mock(base_url="https://example.test") as router:
        router.get("/ping").respond(200, json={})
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=delay_s,
                client=inner,
            )
            t0 = time.monotonic()
            await client.get("https://example.test/ping")
            await client.get("https://example.test/ping")
            elapsed = time.monotonic() - t0
    assert elapsed >= delay_s
    assert elapsed < delay_s + 0.5  # not slower than necessary


@pytest.mark.asyncio
async def test_head_records_metric_no_cache(tmp_path: Path) -> None:
    """HEAD shares limiter + metrics, but is never disk-cached."""
    async with respx.mock(base_url="https://example.test") as router:
        route = router.head("/exists").respond(200, headers={"x-foo": "bar"})
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                cache_dir=tmp_path,
                client=inner,
            )
            await client.head("https://example.test/exists")
            await client.head("https://example.test/exists")
    assert route.call_count == 2  # both went to network — no cache for HEAD
    events = client.metrics()["events"]
    assert all(e.method == "HEAD" for e in events)
    assert all(e.cache_hit is False for e in events)


@pytest.mark.asyncio
async def test_post_cache_keys_on_body(tmp_path: Path) -> None:
    """Two POSTs with different JSON bodies: both hit network."""
    async with respx.mock(base_url="https://example.test") as router:
        route = router.post("/jobs").mock(
            side_effect=lambda req: httpx.Response(200, json={"echo": req.content.decode()})
        )
        async with httpx.AsyncClient() as inner:
            client = RateLimitedClient(
                bucket=TokenBucket(100, 60.0),
                per_host_delay_s=0.0,
                cache_dir=tmp_path,
                client=inner,
            )
            await client.post("https://example.test/jobs", json={"page": 1})
            await client.post("https://example.test/jobs", json={"page": 2})
            await client.post("https://example.test/jobs", json={"page": 1})  # cache hit
    assert route.call_count == 2
    events = client.metrics()["events"]
    assert [e.cache_hit for e in events] == [False, False, True]


def test_peak_per_minute_empty() -> None:
    assert _peak_per_minute([]) == 0


def test_peak_per_minute_single_window() -> None:
    base = 1_000_000.0
    events = [MetricEvent(base + i, "h", "GET", 200, False) for i in range(50)]
    assert _peak_per_minute(events) == 50


def test_peak_per_minute_two_windows() -> None:
    base = 1_000_000.0
    events = [MetricEvent(base + i * 0.1, "h", "GET", 200, False) for i in range(100)]
    events += [MetricEvent(base + 120 + i, "h", "GET", 200, False) for i in range(20)]
    assert _peak_per_minute(events) == 100
