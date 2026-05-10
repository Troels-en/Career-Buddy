import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { FilterBar } from "@/components/jobs/FilterBar";
import { JobCard } from "@/components/jobs/JobCard";
import { loadCareerBuddyState } from "@/lib/cv-storage";
import {
  loadPresets,
  persistPresets,
  type FilterPreset,
} from "@/lib/filter-presets";
import {
  applyFilters,
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
 * Phase 3 — standalone jobs feed for `/jobs`. Replaces the prior
 * `<CareerBuddy rolesOnly />` placeholder mount so the route no longer
 * pulls in the monolith's profile / tracker / CV / draft surfaces.
 *
 * Scope vs Overview's role grid (lives in CareerBuddy.tsx still):
 *  - same fetch shape (10k-row PostgREST window via `.range`),
 *  - same fitScore + sortJobs from lib,
 *  - same FilterBar (extracted to src/components/jobs/FilterBar.tsx),
 *  - same JobCard (extracted to src/components/jobs/JobCard.tsx),
 *  - DROP: per-card match-job AI fit (stateful + quota-bound — stays
 *    on Overview where the profile/tracker live);
 *  - DROP: Add to tracker + Draft modal (those need profile/state +
 *    Supabase applications upsert — Overview territory).
 *
 * Browse + filter + sort on `/jobs`; Analyze + Apply on `/`.
 */

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

export function JobsFeed() {
  const [jobs, setJobs] = useState<VcJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPresets(loadPresets());
    void (async () => {
      const { data: dismissedRows } = await supabase
        .from("job_dismissals")
        .select("url");
      const urls = (dismissedRows ?? []).map((r) => r.url).filter(Boolean);
      setDismissedSet(new Set(urls));
    })();
    void (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "company_name, role_title, role_category, location, url, ats_source, posted_date, is_remote, description, requirements, years_min, years_max, salary_min, salary_max, salary_currency, languages_required, level, country, city, visa_sponsorship, is_international",
        )
        .eq("is_active", true)
        .order("posted_date", { ascending: false, nullsFirst: false })
        .range(0, 9999);
      if (error) {
        console.error("[jobs-feed] fetch failed", error);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as JobRow[];
      setJobs(
        rows.map((r) => {
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
        }),
      );
      setLoading(false);
    })();
  }, []);

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

  const filteredJobs = useMemo(
    () => applyFilters(jobs, filters, dismissedSet),
    [jobs, filters, dismissedSet],
  );

  const rankedJobs: ScoredJob[] = useMemo(() => {
    return filteredJobs
      .map((j) => {
        const { score, matched } = fitScore(j, fitProfile, profTokens, profYears);
        return {
          ...j,
          fit: score,
          matched,
          why: fitWhy(j, fitProfile, matched),
        };
      })
      .sort((a, b) => sortJobs(a, b, filters.sort))
      .slice(0, 200);
  }, [filteredJobs, fitProfile, profTokens, profYears, filters.sort]);

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

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-semibold text-cinema-ink">
          {loading ? "Loading live openings…" : `${rankedJobs.length} of ${jobs.length} live operator-track roles`}
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

      {rankedJobs.length >= 200 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Showing the first 200 ranked roles. Narrow filters to surface deeper matches.
        </div>
      )}

      <p className="mt-8 text-xs text-cinema-ink-mute text-center">
        Need AI fit-analysis or "add to tracker" on a role?{" "}
        <a href="/" className="underline text-cinema-pine">Open Overview</a> — the AI loop lives there.
      </p>
    </section>
  );
}
