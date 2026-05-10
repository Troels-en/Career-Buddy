/**
 * Persisted filter-preset storage.
 *
 * Users save named filter combos ("Strategy roles in DACH", etc.) and
 * restore them on a click. Lives in localStorage; will move to
 * Supabase when multi-tenant auth lands.
 *
 * Keyed by `career-buddy-filter-presets-v1`. Loader is defensive —
 * any corrupted entry is silently dropped, never throws.
 */

import { type Filters } from "./job-filters";

export const FILTER_PRESETS_KEY = "career-buddy-filter-presets-v1";

export type FilterPreset = {
  name: string;
  filters: Filters;
};

export function loadPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FILTER_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is FilterPreset =>
        !!p && typeof p === "object" && typeof p.name === "string" && !!p.filters,
    );
  } catch {
    return [];
  }
}

export function persistPresets(presets: FilterPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore quota / SecurityError */
  }
}
