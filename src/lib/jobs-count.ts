/**
 * Live count of active rows in the public `jobs` table.
 *
 * Used by the PromoBar (and any other always-on chrome) so the
 * headline figure stays honest as the scraper ingests new rows
 * over time. The scrape pipeline grew the active set from ~9.9K
 * → 28K+ between rounds 12 and 14; hardcoded strings drifted out
 * of sync within days. This hook keeps a single source of truth.
 *
 * Cheap query: `select id, count=exact, head=true` returns no
 * rows, only the count header. PostgREST handles it via the
 * `Prefer: count=exact` header automatically.
 *
 * Cached via React Query — 5 min stale time so a single page
 * load doesn't refetch on every route change, but a daily-return
 * visit shows the latest count.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const ACTIVE_JOBS_COUNT_QUERY_KEY = ["active-jobs-count"] as const;

async function fetchActiveJobsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

export function useActiveJobsCount() {
  return useQuery({
    queryKey: ACTIVE_JOBS_COUNT_QUERY_KEY,
    queryFn: fetchActiveJobsCount,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Format an integer with locale-aware thousand separators
 * (e.g. 28290 → "28,290" or "28.290" depending on user locale).
 * Falls back to plain digits on environments without Intl.
 */
export function formatJobsCount(n: number): string {
  try {
    return new Intl.NumberFormat(undefined).format(n);
  } catch {
    return String(n);
  }
}
