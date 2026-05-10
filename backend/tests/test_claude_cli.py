"""Tests for claude_cli.ClaudeCli + cli.classify_tier2_claude prompt/parse."""

from __future__ import annotations

import json
import subprocess
from typing import Any
from unittest.mock import patch

import pytest

from career_buddy_scraper.claude_cli import (
    ClaudeCli,
    ClaudeCliError,
    ParseError,
    RateLimited,
    Timeout,
    _extract_json,
    _looks_rate_limited,
)
from career_buddy_scraper.cli.classify_tier2_claude import (
    CATEGORIES,
    SNIPPET_CHARS,
    _build_content_block,
    build_prompt,
    parse_response,
)

# ---------------------------------------------------------------------------
# claude_cli — internal helpers
# ---------------------------------------------------------------------------


def test_extract_json_direct() -> None:
    assert _extract_json('[{"id": 0, "category": "other"}]') == [
        {"id": 0, "category": "other"}
    ]


def test_extract_json_strips_markdown_fence() -> None:
    out = _extract_json('```json\n[{"id": 1, "category": "bd"}]\n```')
    assert out == [{"id": 1, "category": "bd"}]


def test_extract_json_strips_bare_fence() -> None:
    out = _extract_json('```\n[{"id": 2, "category": "bizops"}]\n```')
    assert out == [{"id": 2, "category": "bizops"}]


def test_extract_json_finds_embedded_array() -> None:
    out = _extract_json('Here is the result:\n[{"id": 0, "category": "other"}]\n')
    assert out == [{"id": 0, "category": "other"}]


def test_extract_json_no_json_raises() -> None:
    with pytest.raises(ParseError):
        _extract_json("no json here, just words")


def test_extract_json_invalid_json_raises() -> None:
    with pytest.raises(ParseError):
        _extract_json("[{bad: json}]")


def test_looks_rate_limited_detects_phrases() -> None:
    assert _looks_rate_limited("rate-limit exceeded")
    assert _looks_rate_limited("HTTP 429")
    assert _looks_rate_limited("too many requests")
    assert _looks_rate_limited("quota exhausted")
    assert not _looks_rate_limited("everything is fine")


# ---------------------------------------------------------------------------
# ClaudeCli — happy path + error mapping (subprocess mocked)
# ---------------------------------------------------------------------------


def _make_completed(stdout: str, stderr: str = "", returncode: int = 0) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        args=["claude"],
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


def test_claudecli_happy_path() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", return_value=_make_completed('[{"id": 0, "category": "other"}]')):
        out = cli.query_json("prompt")
    assert out == [{"id": 0, "category": "other"}]


def test_claudecli_timeout_raises_typed() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(["claude"], 30)), pytest.raises(Timeout):
        cli.query_json("prompt", timeout=30)


def test_claudecli_missing_binary_raises() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", side_effect=FileNotFoundError("claude not found")), pytest.raises(ClaudeCliError):
        cli.query_json("prompt")


def test_claudecli_nonzero_exit_raises() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", return_value=_make_completed("", "boom", returncode=1)), pytest.raises(ClaudeCliError):
        cli.query_json("prompt")


def test_claudecli_rate_limited_signal_in_stderr() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", return_value=_make_completed("", "HTTP 429 too many requests", returncode=1)), pytest.raises(RateLimited):
        cli.query_json("prompt")


def test_claudecli_empty_stdout_raises() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", return_value=_make_completed("   \n  ")), pytest.raises(ClaudeCliError):
        cli.query_json("prompt")


def test_claudecli_unparseable_stdout_raises() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    with patch("subprocess.run", return_value=_make_completed("not json at all")), pytest.raises(ParseError):
        cli.query_json("prompt")


def test_claudecli_argv_passes_model() -> None:
    cli = ClaudeCli(model="claude-haiku-4-5", inter_call_sleep=0)
    assert "--model" in cli._argv()
    assert "claude-haiku-4-5" in cli._argv()


def test_claudecli_argv_omits_model_when_default() -> None:
    cli = ClaudeCli(inter_call_sleep=0)
    assert "--model" not in cli._argv()


# ---------------------------------------------------------------------------
# Prompt-builder + parser
# ---------------------------------------------------------------------------


def test_build_prompt_wraps_in_xml() -> None:
    prompt = build_prompt([(0, "<title>A</title><snippet></snippet>")])
    assert '<job id="0">' in prompt
    assert "</job>" in prompt
    assert "DATA ONLY" in prompt
    assert "STRICT JSON" in prompt


def test_build_prompt_lists_all_categories() -> None:
    prompt = build_prompt([(0, "x")])
    for cat in CATEGORIES:
        assert cat in prompt


def test_parse_response_happy() -> None:
    raw = [
        {"id": 0, "category": "other"},
        {"id": 1, "category": "bizops"},
    ]
    assert parse_response(raw, batch_size=2) == {0: "other", 1: "bizops"}


def test_parse_response_drops_out_of_range_id() -> None:
    raw = [
        {"id": 0, "category": "other"},
        {"id": 99, "category": "bd"},  # out of batch range
    ]
    out = parse_response(raw, batch_size=2)
    assert out == {0: "other"}


def test_parse_response_drops_invalid_category() -> None:
    raw = [
        {"id": 0, "category": "other"},
        {"id": 1, "category": "made-up-cat"},
    ]
    out = parse_response(raw, batch_size=2)
    assert out == {0: "other"}


def test_parse_response_drops_non_dict_entries() -> None:
    raw: list[Any] = [
        {"id": 0, "category": "bd"},
        "not a dict",
        None,
    ]
    out = parse_response(raw, batch_size=3)
    assert out == {0: "bd"}


def test_parse_response_non_list_raises() -> None:
    with pytest.raises(ParseError):
        parse_response({"id": 0, "category": "other"}, batch_size=1)


def test_parse_response_string_id_dropped() -> None:
    raw = [{"id": "0", "category": "other"}]  # string id, not int
    assert parse_response(raw, batch_size=1) == {}


# ---------------------------------------------------------------------------
# Content-block helper
# ---------------------------------------------------------------------------


def test_build_content_block_uses_requirements_first() -> None:
    out = _build_content_block("CEO", "must have GSD energy", "long description")
    assert "<title>CEO</title>" in out
    assert "must have GSD energy" in out
    assert "long description" not in out  # requirements wins


def test_build_content_block_falls_back_to_description() -> None:
    out = _build_content_block("CEO", None, "long description")
    assert "long description" in out


def test_build_content_block_truncates_snippet() -> None:
    long_text = "x" * (SNIPPET_CHARS * 3)
    out = _build_content_block("X", long_text, None)
    # snippet portion must be no longer than SNIPPET_CHARS
    snippet_start = out.index("<snippet>") + len("<snippet>")
    snippet_end = out.index("</snippet>")
    assert snippet_end - snippet_start <= SNIPPET_CHARS


def test_build_content_block_handles_none() -> None:
    out = _build_content_block("X", None, None)
    assert out == "<title>X</title><snippet></snippet>"


# ---------------------------------------------------------------------------
# Quota helper — mock cursor
# ---------------------------------------------------------------------------


class _StubCursor:
    """Minimal mock of psycopg cursor for _check_quota."""

    def __init__(self, rows: list[tuple[Any, ...]]) -> None:
        self._rows = rows
        self.executed: list[tuple[str, Any]] = []

    def execute(self, sql: str, *args: Any) -> None:
        self.executed.append((sql, args))

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._rows.pop(0) if self._rows else None


def test_check_quota_returns_int_from_row() -> None:
    from career_buddy_scraper.cli.classify_tier2_claude import _check_quota
    cur = _StubCursor([(1234,)])
    assert _check_quota(cur, max_per_day=2000) == 1234


def test_check_quota_returns_zero_when_no_row() -> None:
    from career_buddy_scraper.cli.classify_tier2_claude import _check_quota
    cur = _StubCursor([])
    assert _check_quota(cur, max_per_day=2000) == 0


# ---------------------------------------------------------------------------
# End-to-end batch-with-retry — happy + retry paths
# ---------------------------------------------------------------------------


def test_classify_batch_with_retry_happy_path() -> None:
    from career_buddy_scraper.cli.classify_tier2_claude import _classify_batch_with_retry
    batch = [
        ("uuid-a", "<title>Eng</title><snippet></snippet>"),
        ("uuid-b", "<title>Sales</title><snippet></snippet>"),
    ]
    cli = ClaudeCli(inter_call_sleep=0)
    fake_response = json.dumps([
        {"id": 0, "category": "other"},
        {"id": 1, "category": "other"},
    ])
    with patch("subprocess.run", return_value=_make_completed(fake_response)):
        out = _classify_batch_with_retry(cli, batch)
    assert out == {"uuid-a": "other", "uuid-b": "other"}


def test_classify_batch_with_retry_partial_then_chunk_succeeds() -> None:
    from career_buddy_scraper.cli.classify_tier2_claude import _classify_batch_with_retry
    batch = [
        ("uuid-a", "<title>A</title><snippet></snippet>"),
        ("uuid-b", "<title>B</title><snippet></snippet>"),
    ]
    cli = ClaudeCli(inter_call_sleep=0)
    # First call: only id=0 returned → partial. Retry with chunk-10:
    # batch is 2 items, so single chunk of 2 → must succeed fully.
    responses = [
        _make_completed(json.dumps([{"id": 0, "category": "other"}])),  # partial main
        _make_completed(json.dumps([
            {"id": 0, "category": "other"},
            {"id": 1, "category": "other"},
        ])),  # full chunk retry
    ]
    with patch("subprocess.run", side_effect=responses):
        out = _classify_batch_with_retry(cli, batch)
    assert out == {"uuid-a": "other", "uuid-b": "other"}


def test_classify_batch_with_retry_repeated_partial_raises() -> None:
    from career_buddy_scraper.cli.classify_tier2_claude import _classify_batch_with_retry
    batch = [
        ("uuid-a", "<title>A</title><snippet></snippet>"),
        ("uuid-b", "<title>B</title><snippet></snippet>"),
    ]
    cli = ClaudeCli(inter_call_sleep=0)
    # Both calls return partial → must raise.
    responses = [
        _make_completed(json.dumps([{"id": 0, "category": "other"}])),
        _make_completed(json.dumps([{"id": 0, "category": "other"}])),
    ]
    with patch("subprocess.run", side_effect=responses), pytest.raises(ClaudeCliError):
        _classify_batch_with_retry(cli, batch)
