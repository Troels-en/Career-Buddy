/**
 * Misc job/profile/application helpers lifted from CareerBuddy.tsx.
 *
 * Pure functions only — no React, no DOM, no localStorage.
 *
 * Public surface:
 *  - {@link cleanSnippet} — collapse whitespace + cap 300 chars
 *  - {@link safeIsoDate} — YYYY-MM-DD → ISO string, null fallback
 *  - {@link profileCompleteness} — 11-field % score for the meter
 *  - {@link applicationToRow} — Application → Supabase row shape
 *  - {@link profileSignature} — deterministic hash of fitness-affecting fields
 */

import type { Database } from "@/integrations/supabase/types";

import { ApplicationStatus } from "./format";

type ApplicationsInsert = Database["public"]["Tables"]["applications"]["Insert"];

// ---------------------------------------------------------------------------
// Structural types — subsets compatible with CareerBuddy.tsx Profile +
// Application + Position so callers pass their richer shape unchanged.
// ---------------------------------------------------------------------------

export type CompletenessProfile = {
  name: string;
  headline: string;
  target_role: string;
  target_geo: string;
  background: string;
  strengths: string[];
  target_role_categories: string[];
  location_preferences: string[];
  cv_analyzed: boolean;
  work_history: unknown[];
  education: unknown[];
};

export type SignatureProfile = {
  target_role: string;
  target_geo: string;
  background: string;
  headline: string;
  strengths: string[];
  target_role_categories: string[];
  location_preferences: string[];
  work_history: { company: string; role: string; bullets: string[] }[];
};

export type ApplicationRowSource = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  last_event: string;
  next_action: string;
  fit: number;
  url?: string;
  notes?: string;
};

// ---------------------------------------------------------------------------

/** Collapse whitespace, trim, cap at 300 chars. "" for null/empty. */
export function cleanSnippet(text: string | null): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Coerce a YYYY-MM-DD-ish string to a full ISO timestamp. Returns null
 * if the input is undefined/empty or doesn't start with a valid date.
 */
export function safeIsoDate(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  return null;
}

/**
 * 11-field completeness check used by the profile meter. Returns the
 * raw counts plus a 0..100 percentage.
 */
export function profileCompleteness(profile: CompletenessProfile): {
  score: number;
  done: number;
  total: number;
} {
  const checks = [
    profile.name.trim(),
    profile.headline.trim(),
    profile.target_role.trim(),
    profile.target_geo.trim(),
    profile.background.trim(),
    profile.strengths.length > 0,
    profile.target_role_categories.length > 0,
    profile.location_preferences.length > 0,
    profile.cv_analyzed,
    profile.work_history.length > 0,
    profile.education.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return {
    score: Math.round((done / checks.length) * 100),
    done,
    total: checks.length,
  };
}

/**
 * Application → Supabase row shape (snake_case columns,
 * `client_id`-keyed for the single-user phase).
 */
export function applicationToRow(a: ApplicationRowSource): ApplicationsInsert {
  return {
    client_id: a.id,
    company: a.company,
    role: a.role,
    status: a.status,
    next_action: a.next_action,
    fit_score: a.fit,
    url: a.url ?? null,
    notes: a.notes ?? null,
    last_event_date: safeIsoDate(a.last_event),
  };
}

/**
 * Deterministic hex hash of the profile fields that influence fit
 * scoring. Used as a cache key — when this changes, all cached
 * match-job results invalidate.
 *
 * Implementation: FNV-1a-ish 32-bit. Sufficient for cache-key
 * collision avoidance; not crypto.
 */
export function profileSignature(p: SignatureProfile): string {
  const parts = [
    p.target_role,
    p.target_geo,
    p.background,
    p.headline,
    [...p.strengths].sort().join("|"),
    [...p.target_role_categories].sort().join("|"),
    [...p.location_preferences].sort().join("|"),
    p.work_history
      .map((w) => `${w.company}-${w.role}-${w.bullets.join(";")}`)
      .join("||"),
  ];
  const blob = parts.join("\n");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < blob.length; i++) {
    h ^= blob.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
