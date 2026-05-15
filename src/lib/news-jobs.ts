/**
 * Top-fit jobs feed used by the /news route and the Overview
 * `TopJobsToday` card. F1 of the round-16 workplan.
 *
 * v1 ships **client-side ranking** per multi-model review consensus:
 *  - PostgREST returns recent `is_active=true` rows in the time window
 *  - browser computes fitScore via the existing `lib/job-fit.ts`
 *    (identical scoring path to `JobsFeed`)
 *  - top-N by fitScore returned
 *
 * Server-side cron-warmed `user_top_jobs_cache` is the F1.1 polish.
 *
 * `last_feed_view_at` lives server-side in `user_feed_state` so the
 * "new since last visit" bucket stays honest across devices.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadCareerBuddyState } from "@/lib/cv-storage";
import {
  fitScore,
  fitWhy,
  profileYearsExperience,
  tokenize,
  type FitProfile,
} from "@/lib/job-fit";
import { sortJobs } from "@/lib/job-filters";
import { track } from "@/lib/telemetry";
import type { ScoredJob, VcJob } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

const SELECT_COLS =
  "company_name, role_title, role_category, location, url, ats_source, posted_date, first_seen_at, is_remote, description, requirements, years_min, years_max, salary_min, salary_max, salary_currency, languages_required, level, country, city, visa_sponsorship, is_international";

export type NewsBucket = "today" | "week" | "new_since_visit";

export const NEWS_JOBS_QUERY_KEY = (
  bucket: NewsBucket,
  lastViewAt: string | null,
  topN: number,
) => ["news-jobs", bucket, lastViewAt, topN] as const;

export const FEED_STATE_QUERY_KEY = ["user-feed-state"] as const;

const WINDOWS = {
  today: 24 * 3600 * 1000,
  week: 7 * 24 * 3600 * 1000,
} as const;

function isoCutoff(windowMs: number): string {
  return new Date(Date.now() - windowMs).toISOString();
}

type NewsJobRow = {
  company_name: string;
  role_title: string;
  role_category: string | null;
  location: string | null;
  url: string;
  ats_source: string;
  posted_date: string | null;
  first_seen_at: string | null;
  is_remote: boolean | null;
  description: string | null;
  requirements: string | null;
  years_min: number | null;
  years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  languages_required: string[] | null;
  level: VcJob["level"];
  country: string | null;
  city: string | null;
  visa_sponsorship: boolean | null;
  is_international: boolean | null;
};

/** Mirror of JobsFeed.mapRow — builds a VcJob with fit tokens. */
function mapRow(r: NewsJobRow): VcJob {
  const desc = (r.description ?? "").slice(0, 4000);
  const reqs = (r.requirements ?? "").slice(0, 2000);
  return {
    company: r.company_name,
    role: r.role_title,
    role_category: r.role_category,
    location: r.location ?? "—",
    url: r.url,
    ats_source: r.ats_source,
    posted_date: r.posted_date,
    is_remote: r.is_remote === true,
    description: r.description,
    requirements: r.requirements,
    years_min: r.years_min,
    years_max: r.years_max,
    salary_min: r.salary_min,
    salary_max: r.salary_max,
    salary_currency: r.salary_currency,
    languages_required: r.languages_required ?? [],
    level: r.level,
    country: r.country,
    city: r.city,
    visa_sponsorship: r.visa_sponsorship,
    is_international: r.is_international === true,
    jobTokens: tokenize(`${r.role_title} ${desc}`),
    reqTokens: tokenize(reqs),
  };
}

/**
 * Fetch active jobs in the given bucket's time window. Server returns
 * `first_seen_at`-ordered up to 999 rows (PostgREST cap); client
 * re-ranks by fit. If the window genuinely exceeds 999 rows the
 * ranking truncates to the most-recent 999 — a `news_feed_truncated`
 * telemetry event fires so F1.1 (server-side cache) can be triggered
 * by real data rather than guesswork.
 */
export async function fetchBucketRows(
  bucket: NewsBucket,
  lastViewAt: string | null,
): Promise<NewsJobRow[]> {
  // Fetch up to 999 rows (PostgREST cap) so client-side fit ranking
  // sees the full week/new-since-visit pool, not just the 200 most
  // recent. The "today" bucket is naturally small; week + since-visit
  // need the wider window to honour the "top-fit of the period" claim.
  let q = supabase
    .from("jobs")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .order("first_seen_at", { ascending: false, nullsFirst: false })
    .range(0, 999);

  if (bucket === "today") {
    q = q.gte("first_seen_at", isoCutoff(WINDOWS.today));
  } else if (bucket === "week") {
    q = q.gte("first_seen_at", isoCutoff(WINDOWS.week));
  } else {
    // new_since_visit — first visit (no anchor) falls back to week
    q = q.gte("first_seen_at", lastViewAt ?? isoCutoff(WINDOWS.week));
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as NewsJobRow[];
  // Detect the silent 999-row truncation ceiling. If a bucket window
  // genuinely returns 1000 rows the client-side ranking is no longer
  // "top-fit of the period" — surface it so F1.1 (server cache) is
  // triggered by data, not a guess.
  if (rows.length >= 1000) {
    void track("news_feed_truncated", { bucket });
  }
  return rows;
}

async function fetchFeedState(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from("user_feed_state")
    .select("last_feed_view_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.last_feed_view_at ?? null;
}

/**
 * Bump `last_feed_view_at` to now. Best-effort; UI never blocks.
 * Called when /news mounts.
 */
export async function bumpFeedView(): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;
    const now = new Date().toISOString();
    await supabase
      .from("user_feed_state")
      .upsert(
        { user_id: userId, last_feed_view_at: now, updated_at: now },
        { onConflict: "user_id" },
      );
  } catch {
    /* swallow */
  }
}

/** Build a FitProfile from the persisted CareerBuddy state. */
function loadFitProfile(): FitProfile {
  const p = loadCareerBuddyState().profile ?? {};
  const wh = Array.isArray(p.work_history) ? p.work_history : [];
  return {
    strengths: Array.isArray(p.strengths) ? p.strengths : [],
    target_role: typeof p.target_role === "string" ? p.target_role : "",
    target_role_categories: Array.isArray(p.target_role_categories)
      ? p.target_role_categories
      : [],
    location_preferences: Array.isArray(p.location_preferences)
      ? p.location_preferences
      : [],
    headline: typeof p.headline === "string" ? p.headline : "",
    work_history: wh as FitProfile["work_history"],
  };
}

export function useFeedState() {
  return useQuery({
    queryKey: FEED_STATE_QUERY_KEY,
    queryFn: fetchFeedState,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Ranked top-N jobs for the given bucket. Scores client-side against
 * the persisted profile using the identical path as `JobsFeed`.
 */
export function useNewsJobs(bucket: NewsBucket, topN = 10) {
  const { data: lastViewAt } = useFeedState();

  const fitProfile = useMemo(loadFitProfile, []);
  // profTokens MUST be built identically to JobsFeed
  // (JobsFeed.tsx:264-267) — headline + strengths + role categories —
  // so a job scores the same on /jobs and /news. Do not swap in
  // buildProfileTokens here without changing JobsFeed in lockstep.
  const profTokens = useMemo(() => {
    const seed = `${fitProfile.headline} ${fitProfile.strengths.join(" ")} ${fitProfile.target_role_categories.join(" ")}`;
    return tokenize(seed);
  }, [fitProfile]);
  const profYears = useMemo(() => {
    const p = loadCareerBuddyState().profile ?? {};
    if (typeof p.years_min === "number" && p.years_min > 0) return p.years_min;
    return profileYearsExperience(fitProfile);
  }, [fitProfile]);

  return useQuery({
    queryKey: NEWS_JOBS_QUERY_KEY(bucket, lastViewAt ?? null, topN),
    queryFn: async (): Promise<ScoredJob[]> => {
      const rows = await fetchBucketRows(bucket, lastViewAt ?? null);
      const scored: ScoredJob[] = rows.map((r) => {
        const j = mapRow(r);
        const { score, matched } = fitScore(j, fitProfile, profTokens, profYears);
        return { ...j, fit: score, matched, why: fitWhy(j, fitProfile, matched) };
      });
      scored.sort((a, b) => sortJobs(a, b, "fit"));
      return scored.slice(0, topN);
    },
    staleTime: 5 * 60 * 1000,
  });
}
