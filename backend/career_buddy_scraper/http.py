"""Rate-limited HTTP client with disk cache and per-host politeness.

Single HTTP entry point for the scraper. All ATS adapters consume an
instance of :class:`RateLimitedClient` via the ``client`` parameter on
``fetch(slug, client)`` and never import ``httpx`` directly.

Politeness contract (per workplan v6 hard rules):

- token-bucket: 100 requests / 60 s (configurable),
- per-host sleep: 200 ms between successive calls to the same host,
- disk cache: 4-hour TTL for ``GET`` and ``POST`` (cache key includes
  the JSON body for ``POST``); ``HEAD`` is never cached,
- metrics: every call records ``(timestamp, host, method, status,
  cache_hit)``,
- User-Agent: ``Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)``.

Cache files live at ``<cache_dir>/<host>/<sha256-prefix>.json`` and store
``{"status": int, "headers": dict, "body": <json>}``. On hit, a synthetic
``httpx.Response`` is returned with the cached status and body so callers
can use ``.json()`` / ``.raise_for_status()`` / ``.status_code`` exactly
as on a live response.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

USER_AGENT = "Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)"
DEFAULT_RATE_LIMIT = 100
DEFAULT_RATE_WINDOW_S = 60.0
DEFAULT_PER_HOST_DELAY_S = 0.2
DEFAULT_CACHE_TTL_S = 4 * 60 * 60
DEFAULT_TIMEOUT_S = 30.0


@dataclass
class TokenBucket:
    """Asyncio token bucket. Refills continuously at ``capacity / period``."""

    capacity: int
    refill_period_s: float
    _tokens: float = field(init=False)
    _last_refill: float = field(init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    def __post_init__(self) -> None:
        self._tokens = float(self.capacity)
        self._last_refill = time.monotonic()

    async def acquire(self) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self._last_refill
                rate = self.capacity / self.refill_period_s
                self._tokens = min(float(self.capacity), self._tokens + elapsed * rate)
                self._last_refill = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                wait_s = (1.0 - self._tokens) / rate
            await asyncio.sleep(wait_s)


@dataclass
class MetricEvent:
    timestamp: float
    host: str
    method: str
    status: int
    cache_hit: bool


class RateLimitedClient:
    """``httpx.AsyncClient`` wrapper with token bucket, per-host sleep, cache."""

    def __init__(
        self,
        *,
        bucket: TokenBucket | None = None,
        per_host_delay_s: float = DEFAULT_PER_HOST_DELAY_S,
        cache_dir: Path | None = None,
        cache_ttl_s: float = DEFAULT_CACHE_TTL_S,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._bucket = bucket or TokenBucket(DEFAULT_RATE_LIMIT, DEFAULT_RATE_WINDOW_S)
        self._per_host_delay_s = per_host_delay_s
        self._cache_dir = cache_dir
        self._cache_ttl_s = cache_ttl_s
        self._client = client or httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=DEFAULT_TIMEOUT_S,
        )
        self._owns_client = client is None
        self._last_host_call: dict[str, float] = {}
        self._host_locks: dict[str, asyncio.Lock] = {}
        self._events: list[MetricEvent] = []

    async def __aenter__(self) -> RateLimitedClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    def metrics(self) -> dict[str, Any]:
        events = list(self._events)
        peak_per_minute = _peak_per_minute(events)
        by_method: Counter[str] = Counter(e.method for e in events)
        by_status: Counter[int] = Counter(e.status for e in events)
        return {
            "total_requests": len(events),
            "cache_hits": sum(1 for e in events if e.cache_hit),
            "peak_per_minute": peak_per_minute,
            "by_method": dict(by_method),
            "by_status": dict(by_status),
            "events": events,
        }

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self._request("GET", url, cached=True, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self._request("POST", url, cached=True, **kwargs)

    async def head(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self._request("HEAD", url, cached=False, **kwargs)

    async def _request(
        self, method: str, url: str, *, cached: bool, **kwargs: Any
    ) -> httpx.Response:
        host = urlparse(url).hostname or "unknown"
        cache_key = _cache_key(method, url, kwargs.get("json"))

        if cached:
            entry = self._load_cache(cache_key)
            if entry is not None:
                self._events.append(
                    MetricEvent(
                        timestamp=time.time(),
                        host=host,
                        method=method,
                        status=int(entry["status"]),
                        cache_hit=True,
                    )
                )
                return _synth_response(entry, method=method, url=url)

        await self._bucket.acquire()
        await self._wait_for_host(host)
        resp = await self._client.request(method, url, **kwargs)
        self._events.append(
            MetricEvent(
                timestamp=time.time(),
                host=host,
                method=method,
                status=resp.status_code,
                cache_hit=False,
            )
        )
        if cached and 200 <= resp.status_code < 300:
            self._store_cache(cache_key, host, resp)
        return resp

    async def _wait_for_host(self, host: str) -> None:
        lock = self._host_locks.setdefault(host, asyncio.Lock())
        async with lock:
            last = self._last_host_call.get(host)
            now = time.monotonic()
            if last is not None:
                gap = now - last
                if gap < self._per_host_delay_s:
                    await asyncio.sleep(self._per_host_delay_s - gap)
            self._last_host_call[host] = time.monotonic()

    def _cache_path(self, cache_key: str, host: str) -> Path | None:
        if self._cache_dir is None:
            return None
        digest = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:32]
        return self._cache_dir / host / f"{digest}.json"

    def _load_cache(self, cache_key: str) -> dict[str, Any] | None:
        if self._cache_dir is None:
            return None
        host = urlparse(cache_key.split("|", 1)[0]).hostname or "unknown"
        path = self._cache_path(cache_key, host)
        if path is None or not path.exists():
            return None
        if time.time() - path.stat().st_mtime > self._cache_ttl_s:
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        if not isinstance(data, dict):
            return None
        return data

    def _store_cache(self, cache_key: str, host: str, resp: httpx.Response) -> None:
        path = self._cache_path(cache_key, host)
        if path is None:
            return
        try:
            body: Any = resp.json()
        except (ValueError, json.JSONDecodeError):
            body = resp.text
        payload = {
            "status": resp.status_code,
            "headers": dict(resp.headers),
            "body": body,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _cache_key(method: str, url: str, body: Any) -> str:
    if method != "POST" or body is None:
        return url
    body_repr = json.dumps(body, sort_keys=True, default=str)
    return f"{url}|{body_repr}"


def _synth_response(
    entry: dict[str, Any], *, method: str = "GET", url: str = ""
) -> httpx.Response:
    body = entry.get("body")
    if isinstance(body, (dict, list)):
        content = json.dumps(body).encode("utf-8")
    elif isinstance(body, str):
        content = body.encode("utf-8")
    else:
        content = b""
    raw_headers = entry.get("headers") or {}
    # Strip transport-encoding headers — body is already decoded in the cache,
    # so leaving content-encoding/content-length would make httpx try to
    # re-decompress and miscount length.
    headers = {
        k: v
        for k, v in raw_headers.items()
        if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")
    }
    if not any(k.lower() == "content-type" for k in headers):
        headers = {**headers, "content-type": "application/json"}
    request = httpx.Request(method=method, url=url) if url else None
    return httpx.Response(
        status_code=int(entry["status"]),
        content=content,
        headers=headers,
        request=request,
    )


def _peak_per_minute(events: list[MetricEvent]) -> int:
    """Highest count of requests in any 60-second sliding window."""
    if not events:
        return 0
    timestamps = sorted(e.timestamp for e in events)
    peak = 0
    left = 0
    for right, t_right in enumerate(timestamps):
        while timestamps[left] < t_right - 60.0:
            left += 1
        peak = max(peak, right - left + 1)
    return peak
