import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { FilterBar } from "@/components/jobs/FilterBar";
import { JobCard } from "@/components/jobs/JobCard";
import { loadCareerBuddyState } from "@/lib/cv-storage";
import {
  loadPresets,
  persistPresets,
  type FilterPreset,
} from "@/lib/filter-presets";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  sortJobs,
  type Filters,
  type JobLevel,
  type SortKey,
} from "@/lib/job-filters";
import {
  fitScore,
  fitWhy,
  profileYearsExperience,
  tokenize,
  type FitProfile,
} from "@/lib/job-fit";
import type { ScoredJob, VcJob } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 3 deep — standalone jobs feed with SERVER-SIDE filter + sort.
 *
 * Every filter chip translates to a PostgREST query param so the
 * Supabase API does the heavy lifting instead of pulling the entire
 * 9,980-row jobs table into the browser on every visit. This is the
 * "C" fix for the 1,000-row PostgREST cap that previously hid 90%
 * of the job feed behind the default max-rows ceiling.
 *
 * Sort policy:
 *  - sort === "fit"  → server returns recency-ordered (default);
 *    client computes fitScore and re-sorts by it. Fit needs profile
 *    context that only the browser has.
 *  - all other sorts → handed straight to PostgREST as `.order(...)`,
 *    so even at 100k rows the server walks indexes instead of
 *    streaming the full table.
 *
 * Pagination: up to 1,000 matching rows per filter set. A tight
 * filter (e.g. "Berlin Senior Python") returns far less than 1,000,
 * so the practical visibility is "every job that matches the user's
 * current filter set" rather than "top of an arbitrary 1,000-row
 * window". A future iteration can add `Load more` for the rare
 * unfiltered case.
 *
 * Behaviour vs Overview (`<CareerBuddy />`):
 *  - Same JobCard + FilterBar markup.
 *  - DROPS the AI-fit + tracker + draft callbacks. /jobs is browse +
 *    filter + sort; / is analyse + apply.
 */

const FETCH_LIMIT = 999; // PostgREST .range(0, 999) → up to 1,000 rows
const DEBOUNCE_MS = 250;

type JobRow = {
  company_name: string;
  role_title: string;
  role_category: string | null;
  location: string | null;
  url: string;
  ats_source: string;
  posted_date: string | null;
  is_remote: boolean | null;
  description: string | null;
  requirements: string | null;
  years_min: number | null;
  years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  languages_required: string[] | null;
  level: JobLevel | null;
  country: string | null;
  city: string | null;
  visa_sponsorship: boolean | null;
  is_international: boolean | null;
};

function postedSinceCutoff(value: Filters["postedSince"]): string | null {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  switch (value) {
    case "today":
      return new Date(now - 1 * day).toISOString().slice(0, 10);
    case "week":
      return new Date(now - 7 * day).toISOString().slice(0, 10);
    case "month":
      return new Date(now - 30 * day).toISOString().slice(0, 10);
    default:
      return null;
  }
}

function buildQuery(filters: Filters) {
  let q = supabase
    .from("jobs")
    .select(
      "company_name, role_title, role_category, location, url, ats_source, posted_date, is_remote, description, requirements, years_min, years_max, salary_min, salary_max, salary_currency, languages_required, level, country, city, visa_sponsorship, is_international",
    )
    .eq("is_active", true);

  if (filters.roleCats.length > 0) q = q.in("role_category", filters.roleCats);
  if (filters.levels.length > 0) q = q.in("level", filters.levels);
  if (filters.countries.length > 0) q = q.in("country", filters.countries);
  if (filters.atsSources.length > 0) q = q.in("ats_source", filters.atsSources);
  if (filters.languages.length > 0) q = q.overlaps("languages_required", filters.languages);

  const cutoff = postedSinceCutoff(filters.postedSince);
  if (cutoff) q = q.gte("posted_date", cutoff);

  if (filters.remoteOnly) q = q.eq("is_remote", true);
  else if (filters.hideRemote) q = q.eq("is_remote", false);

  if (filters.visaSponsorshipOnly) q = q.eq("visa_sponsorship", true);
  if (filters.internationalOnly) q = q.eq("is_international", true);

  if (filters.locationQuery.trim()) {
    q = q.ilike("location", `%${filters.locationQuery.trim()}%`);
  }

  if (filters.maxYearsRequired !== null) {
    if (filters.maxYearsRequired === 0) {
      q = q.is("years_min", null);
    } else {
      // Entry-friendly: include rows with no years constraint OR
      // years_min ≤ user max.
      q = q.or(`years_min.is.null,years_min.lte.${filters.maxYearsRequired}`);
    }
  }

  // Server-side sort — fit-based sort happens client-side after
  // scoring against profile.
  switch (filters.sort) {
    case "recency":
    case "fit":
      q = q.order("posted_date", { ascending: false, nullsFirst: false });
      break;
    case "company":
      q = q.order("company_name", { ascending: true });
      break;
    case "years_asc":
      q = q.order("years_min", { ascending: true, nullsFirst: false });
      break;
    case "salary_desc":
      q = q.order("salary_max", { ascending: false, nullsFirst: false });
      break;
  }

  return q.range(0, FETCH_LIMIT);
}

function mapRow(r: JobRow): VcJob {
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

export function JobsFeed() {
  const [jobs, setJobs] = useState<VcJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());
  const reqIdRef = useRef(0);

  useEffect(() => {
    setPresets(loadPresets());
    void (async () => {
      const { data: dismissedRows } = await supabase
        .from("job_dismissals")
        .select("url");
      const urls = (dismissedRows ?? []).map((r) => r.url).filter(Boolean);
      setDismissedSet(new Set(urls));
    })();
  }, []);

  // Debounced server-side fetch on filter change. Each new filter
  // mutation bumps reqIdRef so an in-flight stale response is dropped
  // when it lands after a newer fetch fired.
  useEffect(() => {
    const myId = ++reqIdRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (jobs.length === 0) setLoading(true);
        else setRefetching(true);
        const { data, error } = await buildQuery(filters);
        if (myId !== reqIdRef.current) return; // stale
        if (error) {
          console.error("[jobs-feed] fetch failed", error);
          setLoading(false);
          setRefetching(false);
          return;
        }
        const rows = (data ?? []) as JobRow[];
        setJobs(rows.map(mapRow));
        setLoading(false);
        setRefetching(false);
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.roleCats,
    filters.levels,
    filters.countries,
    filters.atsSources,
    filters.languages,
    filters.postedSince,
    filters.remoteOnly,
    filters.hideRemote,
    filters.visaSponsorshipOnly,
    filters.internationalOnly,
    filters.locationQuery,
    filters.maxYearsRequired,
    filters.sort,
  ]);

  const fitProfile: FitProfile = useMemo(() => {
    const p = loadCareerBuddyState().profile ?? {};
    const wh = Array.isArray(p.work_history) ? p.work_history : [];
    return {
      strengths: Array.isArray(p.strengths) ? p.strengths : [],
      target_role: typeof p.target_role === "string" ? p.target_role : "",
      target_role_categories: Array.isArray(p.target_role_categories) ? p.target_role_categories : [],
      location_preferences: Array.isArray(p.location_preferences) ? p.location_preferences : [],
      headline: typeof p.headline === "string" ? p.headline : "",
      work_history: wh as FitProfile["work_history"],
    };
  }, []);
  const profTokens = useMemo(() => {
    const seed = `${fitProfile.headline} ${fitProfile.strengths.join(" ")} ${fitProfile.target_role_categories.join(" ")}`;
    return tokenize(seed);
  }, [fitProfile]);
  const profYears = useMemo(() => {
    const p = loadCareerBuddyState().profile ?? {};
    if (typeof p.years_min === "number" && p.years_min > 0) return p.years_min;
    return profileYearsExperience(fitProfile);
  }, [fitProfile]);

  // Server filtered already — only drop dismissed rows here.
  const visibleJobs = useMemo(
    () => jobs.filter((j) => !dismissedSet.has(j.url)),
    [jobs, dismissedSet],
  );

  const rankedJobs: ScoredJob[] = useMemo(() => {
    const scored = visibleJobs.map((j) => {
      const { score, matched } = fitScore(j, fitProfile, profTokens, profYears);
      return {
        ...j,
        fit: score,
        matched,
        why: fitWhy(j, fitProfile, matched),
      };
    });
    // Only fit-sort needs re-sort here; server already returned the
    // other sort orders. Re-sort everything anyway for consistency.
    scored.sort((a, b) => sortJobs(a, b, filters.sort));
    return scored.slice(0, 200);
  }, [visibleJobs, fitProfile, profTokens, profYears, filters.sort]);

  const topThreshold = rankedJobs[2]?.fit ?? 0;

  function saveCurrentAsPreset() {
    const name = window.prompt("Name this filter preset:");
    if (!name?.trim()) return;
    const next: FilterPreset[] = [
      ...presets.filter((p) => p.name !== name),
      { name: name.trim(), filters },
    ];
    setPresets(next);
    persistPresets(next);
  }

  function applyPreset(p: FilterPreset) {
    setFilters({ ...p.filters });
    setFiltersOpen(true);
  }

  function deletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    persistPresets(next);
  }

  const hasFilters = countActiveFilters(filters) > 0;

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-semibold text-cinema-ink inline-flex items-center gap-2">
          {loading
            ? "Loading live openings…"
            : hasFilters
              ? `${rankedJobs.length} of ${visibleJobs.length} matching live roles`
              : `${rankedJobs.length} of ${visibleJobs.length} live operator-track roles`}
          {refetching && <Loader2 className="w-4 h-4 animate-spin text-cinema-ink-mute" />}
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}
            className="border rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="fit">Sort: best fit</option>
            <option value="recency">Sort: most recent</option>
            <option value="years_asc">Sort: fewest years required</option>
            <option value="salary_desc">Sort: highest salary</option>
            <option value="company">Sort: company A→Z</option>
          </select>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="px-3 py-1.5 border rounded-lg flex items-center gap-1 text-gray-700 hover:bg-gray-50"
          >
            Filters
            {countActiveFilters(filters) > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-cinema-moss text-white">
                {countActiveFilters(filters)}
              </span>
            )}
            {filtersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          jobs={jobs}
          presets={presets}
          onSavePreset={saveCurrentAsPreset}
          onApplyPreset={applyPreset}
          onDeletePreset={deletePreset}
        />
      )}

      {!loading && rankedJobs.length === 0 && (
        <div className="text-sm text-gray-500 py-12 text-center">
          No roles match the current filters. Reset or broaden the filter set.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rankedJobs.map((j, idx) => (
          <JobCard
            key={`${j.company}-${j.role}-${j.url}`}
            job={j}
            isTop={idx < 3 && j.fit >= 7.0 && j.fit >= topThreshold}
          />
        ))}
      </div>

      {visibleJobs.length >= 1000 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Showing the first 1,000 matching roles. Add more filters to narrow further.
        </div>
      )}

      <p className="mt-8 text-xs text-cinema-ink-mute text-center">
        Need AI fit-analysis or "add to tracker" on a role?{" "}
        <a href="/" className="underline text-cinema-pine">Open Overview</a> — the AI loop lives there.
      </p>
    </section>
  );
}
