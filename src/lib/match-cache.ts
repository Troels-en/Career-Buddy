/**
 * Match-cache + quota storage for the per-job AI fit grading.
 *
 * `match-job` is a Gemini call (Supabase edge function). Results are
 * cached in localStorage keyed by job id, with a profile-signature
 * stamp that invalidates when the user's profile changes. Quota
 * state tracks per-day usage + a 4-hour cooldown when 429s land.
 *
 * Public surface:
 *  - {@link MatchResult} — the structured grading shape (score,
 *    verdict, skills, reasons, blockers, suggestion)
 *  - {@link MatchEntry} — UI-side state machine for one job's match
 *  - {@link MatchCache} — id → cached entry map
 *  - {@link MATCH_*} constants — keys + cooldown + daily limit
 *  - {@link loadMatchCache} / {@link persistMatchCache}
 *  - {@link readQuotaState} / {@link writeQuotaState}
 */

export type MatchResult = {
  score: number;
  verdict: "strong" | "moderate" | "weak";
  matched_skills: string[];
  missing_skills: string[];
  experience_match: string;
  reasons: string[];
  blockers?: string[];
  suggestion: string;
};

export type MatchEntry =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string; retryAfterMs?: number }
  | {
      status: "ready";
      result: MatchResult;
      profile_signature: string;
      computed_at: number;
    };

export type MatchCache = Record<
  string,
  { result: MatchResult; profile_signature: string; computed_at: number }
>;

export type QuotaState = {
  quotaHitAt: number | null;
  runs: { date: string; count: number };
};

export const MATCH_CACHE_KEY = "career-buddy-matches-v1";
export const MATCH_QUOTA_KEY = "career-buddy-match-quota-v1";

/** Cooldown after a 429 — block any further calls for 4 hours. */
export const MATCH_QUOTA_COOLDOWN_MS = 4 * 3600 * 1000;

/** Soft-cap per-day to budget the Gemini Free Tier (20 RPD). */
export const MATCH_DAILY_LIMIT = 10;

const EMPTY_QUOTA: QuotaState = {
  quotaHitAt: null,
  runs: { date: "", count: 0 },
};

// ---------------------------------------------------------------------------
// MatchCache
// ---------------------------------------------------------------------------

export function loadMatchCache(): MatchCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MATCH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MatchCache;
    }
    return {};
  } catch {
    return {};
  }
}

export function persistMatchCache(cache: MatchCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota / SecurityError */
  }
}

// ---------------------------------------------------------------------------
// QuotaState
// ---------------------------------------------------------------------------

export function readQuotaState(): QuotaState {
  if (typeof window === "undefined") return { ...EMPTY_QUOTA };
  try {
    const raw = window.localStorage.getItem(MATCH_QUOTA_KEY);
    if (!raw) return { ...EMPTY_QUOTA };
    const parsed = JSON.parse(raw) as Partial<QuotaState>;
    return {
      quotaHitAt: typeof parsed.quotaHitAt === "number" ? parsed.quotaHitAt : null,
      runs: {
        date: typeof parsed.runs?.date === "string" ? parsed.runs.date : "",
        count: typeof parsed.runs?.count === "number" ? parsed.runs.count : 0,
      },
    };
  } catch {
    return { ...EMPTY_QUOTA };
  }
}

export function writeQuotaState(state: QuotaState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MATCH_QUOTA_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
