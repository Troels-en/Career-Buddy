"""Standalone subprocess wrapper for the local ``claude`` CLI.

Why standalone: hard rule says no Anthropic API auto-pay; Claude calls go
through the user's Max-20x OAuth Claude Code CLI subprocess. This module
is purely a thin wrapper — it does not depend on ``scripts/claude_cli_shim.py``
(which is a different concern: HTTP /chat for the browser).

Use case: batch classification of job titles for ``cli.classify_tier2_claude``.

Errors are typed so the CLI can react differently:
- :class:`RateLimited`: claude CLI signalled rate-limit / quota.
- :class:`Timeout`: subprocess timed out.
- :class:`ParseError`: stdout was not parseable JSON.
- :class:`ClaudeCliError`: catch-all (non-zero exit, missing binary, etc.).
"""

from __future__ import annotations

import json
import logging
import re
import subprocess
import time
from typing import Any

log = logging.getLogger(__name__)


class ClaudeCliError(RuntimeError):
    """Generic Claude CLI failure."""


class RateLimited(ClaudeCliError):
    """Claude CLI rate-limited; caller should pause."""


class Timeout(ClaudeCliError):
    """Subprocess timed out."""


class ParseError(ClaudeCliError):
    """Stdout was not valid JSON."""


_RATELIMIT_PATTERNS = [
    re.compile(r"rate[\s\-]?limit", re.I),
    re.compile(r"quota", re.I),
    re.compile(r"too many requests", re.I),
    re.compile(r"\b429\b"),
]


def _looks_rate_limited(text: str) -> bool:
    return any(p.search(text) for p in _RATELIMIT_PATTERNS)


def _extract_json(stdout: str) -> Any:
    """Pull the first valid JSON document out of stdout.

    Claude CLI sometimes prefixes JSON with markdown fences or commentary.
    Tries direct parse first, then strips fences, then a regex fallback.
    """
    s = stdout.strip()
    # Direct parse.
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    # Strip ``` fences (``` or ```json).
    fence = re.match(r"^```(?:json)?\s*\n(.*?)\n```\s*$", s, re.S)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass
    # Greedy first {...} or [...] match.
    obj = re.search(r"(\{.*\}|\[.*\])", s, re.S)
    if obj:
        try:
            return json.loads(obj.group(1))
        except json.JSONDecodeError as e:
            raise ParseError(f"could not parse JSON from stdout: {e}") from e
    raise ParseError(f"no JSON found in stdout: {s[:200]!r}")


class ClaudeCli:
    """Thin wrapper around ``claude --print`` for batch classification.

    :param model: optional model override (e.g. ``claude-haiku-4-5``).
        ``None`` → CLI default (Sonnet 4.6 on Max-20x sub).
    :param inter_call_sleep: seconds to sleep between subprocess calls.
        Defaults to 5s; serializes load on the Max sub. Set to 0 for tests.
    """

    def __init__(
        self,
        model: str | None = None,
        inter_call_sleep: float = 5.0,
    ) -> None:
        self._model = model
        self._sleep = inter_call_sleep
        self._last_call_at: float | None = None

    def _argv(self) -> list[str]:
        cmd = ["claude", "--print", "--permission-mode", "bypassPermissions"]
        if self._model:
            cmd += ["--model", self._model]
        return cmd

    def query_json(self, prompt: str, timeout: int = 120) -> Any:
        """Run prompt through claude CLI and return parsed JSON.

        Raises:
            Timeout: subprocess exceeded ``timeout`` seconds.
            RateLimited: stderr/stdout indicates rate-limit / quota.
            ParseError: stdout did not contain valid JSON.
            ClaudeCliError: any other failure (binary missing, non-zero exit).
        """
        # Inter-call serialization (skip for first call).
        if self._last_call_at is not None and self._sleep > 0:
            elapsed = time.monotonic() - self._last_call_at
            if elapsed < self._sleep:
                time.sleep(self._sleep - elapsed)

        try:
            proc = subprocess.run(
                self._argv(),
                input=prompt,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except FileNotFoundError as e:
            raise ClaudeCliError("claude CLI not found on PATH") from e
        except subprocess.TimeoutExpired as e:
            raise Timeout(f"claude CLI timed out after {timeout}s") from e
        finally:
            self._last_call_at = time.monotonic()

        if proc.returncode != 0:
            stderr = (proc.stderr or "")[-500:]
            if _looks_rate_limited(stderr) or _looks_rate_limited(proc.stdout or ""):
                raise RateLimited(f"rate-limited: {stderr}")
            raise ClaudeCliError(
                f"claude CLI exited {proc.returncode}: {stderr}"
            )

        if not proc.stdout.strip():
            raise ClaudeCliError("claude CLI returned empty stdout")

        return _extract_json(proc.stdout)
