import { useMemo } from "react";
import { X } from "lucide-react";

import type { FilterPreset } from "@/lib/filter-presets";
import type { Filters, JobLevel } from "@/lib/job-filters";
import { ROLE_CATEGORY_OPTIONS } from "@/lib/types";
import type { VcJob } from "@/lib/types";

/**
 * Phase 3 — FilterBar extracted from CareerBuddy.tsx so /jobs can mount
 * the filter UI without the monolith. Pure presentational: filters
 * state + change callback come from the parent. Live counts derived
 * from `jobs` so each chip shows how many roles match the dimension
 * currently visible.
 */

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  jobs: VcJob[];
  presets: FilterPreset[];
  onSavePreset: () => void;
  onApplyPreset: (p: FilterPreset) => void;
  onDeletePreset: (name: string) => void;
};

export function FilterBar({
  filters,
  onChange,
  onReset,
  jobs,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: Props) {
  const atsCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.ats_source, (m.get(j.ats_source) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (j.role_category) m.set(j.role_category, (m.get(j.role_category) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const countryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (j.country) m.set(j.country, (m.get(j.country) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const levelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (j.level) m.set(j.level, (m.get(j.level) ?? 0) + 1);
    }
    return m;
  }, [jobs]);

  function toggleArr(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <div className="border rounded-xl bg-gray-50 p-4 mb-4 space-y-4">
      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">Role category</div>
        <div className="flex flex-wrap gap-2">
          {ROLE_CATEGORY_OPTIONS.map((cat) => {
            const on = filters.roleCats.includes(cat);
            const count = catCounts.find(([c]) => c === cat)?.[1] ?? 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ ...filters, roleCats: toggleArr(filters.roleCats, cat) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-cinema-moss border-cinema-moss text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
              >
                {cat} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Location contains</div>
          <input
            type="text"
            placeholder="e.g. Berlin, Remote"
            value={filters.locationQuery}
            onChange={(e) => onChange({ ...filters, locationQuery: e.target.value })}
            className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white"
          />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Posted</div>
          <select
            value={filters.postedSince}
            onChange={(e) => onChange({ ...filters, postedSince: e.target.value as Filters["postedSince"] })}
            className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="any">Any time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Remote</div>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={filters.remoteOnly}
                onChange={(e) => onChange({ ...filters, remoteOnly: e.target.checked, hideRemote: e.target.checked ? false : filters.hideRemote })}
              />
              Remote only
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={filters.hideRemote}
                onChange={(e) => onChange({ ...filters, hideRemote: e.target.checked, remoteOnly: e.target.checked ? false : filters.remoteOnly })}
              />
              Hide remote
            </label>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">Seniority level</div>
        <div className="flex flex-wrap gap-2">
          {(["intern","junior","mid","senior","lead","principal","executive"] as JobLevel[]).map((lvl) => {
            const on = filters.levels.includes(lvl);
            const count = levelCounts.get(lvl) ?? 0;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange({ ...filters, levels: (toggleArr(filters.levels as string[], lvl) as JobLevel[]) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-cinema-moss border-cinema-moss text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
              >
                {lvl} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">Country</div>
        <div className="flex flex-wrap gap-2">
          {countryCounts.slice(0, 14).map(([country, count]) => {
            const on = filters.countries.includes(country);
            return (
              <button
                key={country}
                type="button"
                onClick={() => onChange({ ...filters, countries: toggleArr(filters.countries, country) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-cinema-moss border-cinema-moss text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
              >
                {country} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={filters.visaSponsorshipOnly}
            onChange={(e) => onChange({ ...filters, visaSponsorshipOnly: e.target.checked })}
          />
          Visa sponsorship only
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={filters.internationalOnly}
            onChange={(e) => onChange({ ...filters, internationalOnly: e.target.checked })}
          />
          Multi-country only
        </label>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-2">ATS source</div>
        <div className="flex flex-wrap gap-2">
          {atsCounts.map(([src, count]) => {
            const on = filters.atsSources.includes(src);
            return (
              <button
                key={src}
                type="button"
                onClick={() => onChange({ ...filters, atsSources: toggleArr(filters.atsSources, src) })}
                className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-cinema-moss border-cinema-moss text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
              >
                {src} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Max years required</div>
          <select
            value={filters.maxYearsRequired === null ? "any" : String(filters.maxYearsRequired)}
            onChange={(e) => onChange({ ...filters, maxYearsRequired: e.target.value === "any" ? null : parseInt(e.target.value, 10) })}
            className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="any">Any</option>
            <option value="0">Entry-level (no years specified)</option>
            <option value="1">≤ 1 year</option>
            <option value="2">≤ 2 years</option>
            <option value="3">≤ 3 years</option>
            <option value="5">≤ 5 years</option>
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Languages I speak (matches JDs needing any)</div>
          <div className="flex flex-wrap gap-2">
            {["English", "German", "French", "Spanish", "Dutch", "Italian", "Portuguese"].map((l) => {
              const on = filters.languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => onChange({ ...filters, languages: toggleArr(filters.languages, l) })}
                  className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-cinema-moss border-cinema-moss text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {presets.length > 0 && <span className="text-xs text-gray-500">Saved:</span>}
          {presets.map((p) => (
            <span key={p.name} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white border">
              <button onClick={() => onApplyPreset(p)} className="text-cinema-pine hover:underline">{p.name}</button>
              <button
                onClick={() => onDeletePreset(p.name)}
                className="text-gray-300 hover:text-red-600"
                aria-label={`Delete preset ${p.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button onClick={onSavePreset} className="text-xs px-2 py-1 rounded-full border border-cinema-sage text-cinema-pine hover:bg-cinema-mint/40">
            + Save as preset
          </button>
        </div>
        <button onClick={onReset} className="text-xs text-gray-600 underline hover:text-gray-800">
          Reset filters
        </button>
      </div>
    </div>
  );
}
