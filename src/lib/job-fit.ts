/**
 * Job-fit scoring + token utilities lifted from CareerBuddy.tsx.
 *
 * Pure functions only — no React, no localStorage, no DOM. The grade
 * a candidate-profile gets against a job is deterministic given the
 * inputs, which makes the helpers test-friendly.
 *
 * Public surface:
 *  - {@link tokenize}, {@link buildProfileTokens} — text → Set<string>
 *  - {@link tokensMatch}, {@link intersect} — set ops with stem-prefix
 *  - {@link parseYearMonth}, {@link profileYearsExperience} — date math
 *  - {@link fitScore} — returns {score, matched} 1.0..9.9 (one decimal)
 *  - {@link fitWhy} — humanise the score: " · "-separated reason chips
 */

export type FitJob = {
  role: string;
  company: string;
  role_category: string | null;
  location: string;
  is_remote: boolean;
  posted_date: string | null;
  years_min: number | null;
  languages_required: string[];
  jobTokens: Set<string>;
  reqTokens: Set<string>;
};

export type FitWorkHistoryEntry = {
  role: string;
  bullets: string[];
  start_date?: string | null;
  end_date?: string | null;
};

export type FitProfile = {
  strengths: string[];
  target_role: string;
  target_role_categories: string[];
  location_preferences: string[];
  headline: string;
  work_history: FitWorkHistoryEntry[];
};

const DACH_CITIES = [
  "berlin",
  "munich",
  "münchen",
  "hamburg",
  "köln",
  "cologne",
  "frankfurt",
  "vienna",
  "wien",
  "zurich",
  "zürich",
  "düsseldorf",
];

// Minimal stopword list — common English+German function words and
// resume-noise verbs. Tuned for noise reduction on JD/profile text.
const STOPWORDS = new Set([
  "the","and","with","for","your","our","you","this","that","will","are","was",
  "were","have","has","had","been","they","their","them","what","when","where",
  "from","into","onto","than","then","such","also","just","very","more","most",
  "any","some","each","every","both","work","team","company","role","job","new",
  "one","two","three","across","over","under","using","use","used","like","etc",
  "able","including","include","required","preferred","candidate","ideal","year",
  "years","plus","skills","skill","strong","good","great","level","time","need",
  "want","get","go","know","feel","make","help","take","high","low","well",
  // Resume-noise verbs
  "closed","worked","built","led","managed","responsible","drove","scaled",
  "launched","grew","developed","created","designed","executed","delivered",
  // German function words
  "das","der","die","den","dem","des","ein","eine","einer","eines","und","oder",
  "mit","für","von","im","auf","bei","aus","als","wie","wenn","wir","sie","du",
  "ihr","unser","haben","hat","ist","sind","sein","werden","wird","kann","können",
]);

const TOKEN_RE = /[a-zäöüß0-9][a-zäöüß0-9+#./-]{2,}/gi;

export function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  const out = new Set<string>();
  for (const m of text.toLowerCase().matchAll(TOKEN_RE)) {
    const tok = m[0].replace(/[.,;:]+$/, "");
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    out.add(tok);
  }
  return out;
}

export function parseYearMonth(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /(\d{4})-(\d{1,2})/.exec(s);
  if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1);
  const yo = /^(\d{4})$/.exec(s.trim());
  if (yo) return new Date(parseInt(yo[1], 10), 0, 1);
  return null;
}

export function profileYearsExperience(profile: FitProfile): number {
  let months = 0;
  for (const w of profile.work_history) {
    const start = parseYearMonth(w.start_date);
    const end =
      w.end_date && /present|current|now/i.test(w.end_date)
        ? new Date()
        : parseYearMonth(w.end_date);
    if (start && end) {
      months += Math.max(
        0,
        (end.getFullYear() - start.getFullYear()) * 12 +
          end.getMonth() -
          start.getMonth(),
      );
    }
  }
  return Math.round(months / 12);
}

export function buildProfileTokens(profile: FitProfile): Set<string> {
  const parts = [
    ...profile.strengths,
    ...profile.work_history.flatMap((p) => [p.role, ...p.bullets]),
    profile.headline,
    profile.target_role,
  ];
  return tokenize(parts.join(" \n "));
}

/**
 * Token match with light stem-prefix (sales/sale, manager/managers).
 * No substring matching ("sales" must NOT match "salesforce").
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (Math.abs(a.length - b.length) > 3) return false;
  return longer.startsWith(shorter.slice(0, Math.max(4, shorter.length - 1)));
}

/**
 * Set intersection with stem-prefix fallback. Iterates the profile
 * set so returned tokens are profile-anchored (the user-facing label
 * shown in fitWhy()). Capped at 8 entries.
 */
export function intersect(profile: Set<string>, job: Set<string>): string[] {
  if (profile.size === 0 || job.size === 0) return [];
  const matched: string[] = [];
  for (const t of profile) {
    if (job.has(t)) {
      matched.push(t);
      continue;
    }
    for (const j of job) {
      if (tokensMatch(t, j)) {
        matched.push(t);
        break;
      }
    }
  }
  return Array.from(new Set(matched)).slice(0, 8);
}

export type FitResult = { score: number; matched: string[] };

/**
 * Grade `job` against `profile`. Returns score 1.0..9.9 (one decimal)
 * plus the matched profile-anchored tokens used in the JD overlap
 * boost. `profTokens` and `profYears` are passed in so callers can
 * memoise them once across many job evaluations.
 */
export function fitScore(
  job: FitJob,
  profile: FitProfile,
  profTokens: Set<string>,
  profYears: number,
): FitResult {
  let score = 5.0;

  if (job.role_category && profile.target_role_categories.includes(job.role_category)) {
    score += 2.5;
  } else if (job.role_category && job.role_category !== "other") {
    score += 0.4;
  } else if (!job.role_category) {
    const t = `${job.role}`.toLowerCase();
    if (
      /founder|operating|biz ?ops|chief of staff|cos\b|strategy|partnerships|investment/.test(
        t,
      )
    ) {
      score += 1.5;
    }
  }

  const loc = (job.location || "").toLowerCase();
  const prefs = profile.location_preferences.map((p) => p.toLowerCase());
  const wantsRemote = prefs.some((p) => /remote/.test(p));
  if (wantsRemote && job.is_remote) score += 1.5;
  if (prefs.some((p) => p && loc.includes(p))) score += 1.5;
  else if (
    prefs.some((p) => /dach|germany|deutschland/.test(p)) &&
    DACH_CITIES.some((c) => loc.includes(c))
  )
    score += 1.0;

  if (job.posted_date) {
    const days = (Date.now() - new Date(job.posted_date).getTime()) / 86_400_000;
    if (days <= 7) score += 0.5;
    else if (days <= 30) score += 0.2;
    else if (days > 90) score -= 0.5;
  }

  // Title-overlap (cheap, always available).
  const haystack = `${job.role} ${job.company}`.toLowerCase();
  const titleOverlaps = profile.strengths.filter((s) => {
    const word = s.toLowerCase().split(/[\s,/-]+/)[0];
    return word.length > 3 && haystack.includes(word);
  }).length;
  score += Math.min(titleOverlaps * 0.3, 1.0);

  // JD keyword overlap: requirements weighted 2× description.
  let matched: string[] = [];
  if (profTokens.size > 0) {
    const reqMatches = intersect(profTokens, job.reqTokens);
    const descMatches = intersect(profTokens, job.jobTokens);
    const reqUnion = new Set(reqMatches);
    const descOnly = descMatches.filter((m) => !reqUnion.has(m));
    matched = [...reqMatches, ...descOnly].slice(0, 8);
    const overlapBoost = Math.min(reqMatches.length * 0.4 + descOnly.length * 0.2, 2.0);
    score += overlapBoost;
  }

  // Years-of-experience gap (Layer-3 enrichment).
  if (job.years_min !== null) {
    const gap = job.years_min - profYears;
    if (gap <= 0) score += 0.4;
    else if (gap <= 1) score -= 0.2;
    else if (gap <= 3) score -= 0.7;
    else score -= 1.5;
  }

  // Languages: penalise if a required language isn't claimed in profile strengths.
  if (job.languages_required.length > 0) {
    const haveLangs = new Set(
      profile.strengths
        .map((s) => s.toLowerCase())
        .flatMap((s) => s.match(/\b(english|german|french|spanish|dutch|italian|portuguese)\b/gi) ?? []),
    );
    const missingLangs = job.languages_required.filter((l) => !haveLangs.has(l.toLowerCase()));
    if (missingLangs.length > 0 && haveLangs.size > 0) {
      score -= 0.5 * missingLangs.length;
    }
  }

  return {
    score: Math.max(1.0, Math.min(9.9, Math.round(score * 10) / 10)),
    matched,
  };
}

/** Humanise the fit decision: " · "-separated reason chips. */
export function fitWhy(job: FitJob, profile: FitProfile, matched: string[]): string {
  const reasons: string[] = [];
  if (job.role_category && profile.target_role_categories.includes(job.role_category)) {
    reasons.push(`role match: ${job.role_category}`);
  }
  const loc = (job.location || "").toLowerCase();
  const prefs = profile.location_preferences.map((p) => p.toLowerCase());
  if (prefs.some((p) => p && loc.includes(p))) reasons.push(`location: ${job.location}`);
  else if (job.is_remote && prefs.some((p) => /remote/.test(p))) reasons.push("remote-friendly");
  else if (
    prefs.some((p) => /dach|germany|deutschland/.test(p)) &&
    DACH_CITIES.some((c) => loc.includes(c))
  ) {
    reasons.push(`DACH: ${job.location}`);
  }
  if (job.posted_date) {
    const days = (Date.now() - new Date(job.posted_date).getTime()) / 86_400_000;
    if (days <= 7) reasons.push("posted this week");
  }
  if (matched.length > 0) {
    reasons.push(`matched: ${matched.slice(0, 3).join(" · ")}`);
  }
  if (reasons.length === 0) return "Review JD to see if it fits.";
  return reasons.slice(0, 4).join(" · ");
}
