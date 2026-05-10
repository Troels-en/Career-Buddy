import { describe, expect, test } from "vitest";

import {
  MATCH_CACHE_KEY,
  MATCH_DAILY_LIMIT,
  MATCH_QUOTA_COOLDOWN_MS,
  MATCH_QUOTA_KEY,
  loadMatchCache,
  persistMatchCache,
  readQuotaState,
  writeQuotaState,
  type MatchCache,
  type MatchResult,
  type QuotaState,
} from "./match-cache";

const sampleResult: MatchResult = {
  score: 7.5,
  verdict: "moderate",
  matched_skills: ["B2B sales"],
  missing_skills: ["SQL"],
  experience_match: "junior fits",
  reasons: ["DACH location", "operator wedge"],
  blockers: [],
  suggestion: "Apply",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  test("cooldown is 4 hours in ms", () => {
    expect(MATCH_QUOTA_COOLDOWN_MS).toBe(4 * 3600 * 1000);
  });

  test("daily limit is positive integer", () => {
    expect(Number.isInteger(MATCH_DAILY_LIMIT)).toBe(true);
    expect(MATCH_DAILY_LIMIT).toBeGreaterThan(0);
  });

  test("storage keys differ from each other", () => {
    expect(MATCH_CACHE_KEY).not.toBe(MATCH_QUOTA_KEY);
  });
});

// ---------------------------------------------------------------------------
// MatchCache
// ---------------------------------------------------------------------------

describe("loadMatchCache", () => {
  test("empty storage → {}", () => {
    expect(loadMatchCache()).toEqual({});
  });

  test("returns parsed cache", () => {
    const cache: MatchCache = {
      "job-1": { result: sampleResult, profile_signature: "abc123", computed_at: 1 },
    };
    localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify(cache));
    expect(loadMatchCache()).toEqual(cache);
  });

  test("corrupted JSON → {}", () => {
    localStorage.setItem(MATCH_CACHE_KEY, "{not json");
    expect(loadMatchCache()).toEqual({});
  });

  test("array root → {}", () => {
    localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadMatchCache()).toEqual({});
  });

  test("null root → {}", () => {
    localStorage.setItem(MATCH_CACHE_KEY, "null");
    expect(loadMatchCache()).toEqual({});
  });
});

describe("persistMatchCache", () => {
  test("round-trips persist → load", () => {
    const cache: MatchCache = {
      "job-a": { result: sampleResult, profile_signature: "sig", computed_at: 100 },
      "job-b": {
        result: { ...sampleResult, score: 9.0, verdict: "strong" },
        profile_signature: "sig",
        computed_at: 200,
      },
    };
    persistMatchCache(cache);
    expect(loadMatchCache()).toEqual(cache);
  });

  test("empty cache round-trips", () => {
    persistMatchCache({});
    expect(loadMatchCache()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// QuotaState
// ---------------------------------------------------------------------------

describe("readQuotaState", () => {
  test("empty storage → empty quota", () => {
    expect(readQuotaState()).toEqual({
      quotaHitAt: null,
      runs: { date: "", count: 0 },
    });
  });

  test("returns persisted state", () => {
    const state: QuotaState = {
      quotaHitAt: 1_234_567,
      runs: { date: "2026-05-10", count: 5 },
    };
    localStorage.setItem(MATCH_QUOTA_KEY, JSON.stringify(state));
    expect(readQuotaState()).toEqual(state);
  });

  test("corrupted JSON → empty quota", () => {
    localStorage.setItem(MATCH_QUOTA_KEY, "{not json");
    expect(readQuotaState()).toEqual({
      quotaHitAt: null,
      runs: { date: "", count: 0 },
    });
  });

  test("partial / wrong-type fields coerce to defaults", () => {
    localStorage.setItem(
      MATCH_QUOTA_KEY,
      JSON.stringify({ quotaHitAt: "not-a-number", runs: { date: 99, count: "5" } }),
    );
    expect(readQuotaState()).toEqual({
      quotaHitAt: null,
      runs: { date: "", count: 0 },
    });
  });
});

describe("writeQuotaState", () => {
  test("round-trips write → read", () => {
    const state: QuotaState = {
      quotaHitAt: 999,
      runs: { date: "2026-05-11", count: 3 },
    };
    writeQuotaState(state);
    expect(readQuotaState()).toEqual(state);
  });

  test("zero state round-trips", () => {
    const state: QuotaState = { quotaHitAt: null, runs: { date: "", count: 0 } };
    writeQuotaState(state);
    expect(readQuotaState()).toEqual(state);
  });
});
