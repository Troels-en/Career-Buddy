import { useState } from "react";
import { Loader2, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";

import { fitColor, formatSalary, relativeDays } from "@/lib/format";
import { cleanSnippet } from "@/lib/jobs-helpers";
import type { MatchEntry, MatchResult } from "@/lib/match-cache";
import type { ScoredJob } from "@/lib/types";

/**
 * Phase 3 — JobCard extracted from CareerBuddy.tsx so /jobs can render
 * the role grid without mounting the full monolith. Stateful (expand /
 * hover-snippet) but otherwise pure — all data + callbacks come from
 * props.
 *
 * Optional callbacks let /jobs render the card in a lighter mode
 * without the AI-fit + tracker integrations (those stay on Overview
 * where the user has full state).
 */

type Props = {
  job: ScoredJob;
  isTop: boolean;
  matchEntry?: MatchEntry;
  matchDisabled?: boolean;
  onAnalyze?: () => void;
  onAdd?: () => void;
  onDismiss?: () => void;
  onDraft?: () => void;
};

export function JobCard({
  job,
  isTop,
  matchEntry,
  matchDisabled = false,
  onAnalyze,
  onAdd,
  onDismiss,
  onDraft,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const status = matchEntry?.status ?? "idle";
  const isReady = status === "ready";
  const result = isReady ? (matchEntry as { result: MatchResult }).result : null;
  const showPanel = expanded && (status === "ready" || status === "loading" || status === "error");
  const snippet = cleanSnippet(job.description);

  return (
    <div
      className={`relative bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition ${isTop ? "ring-2 ring-cinema-sage/60" : ""}`}
      onMouseEnter={() => setShowSnippet(true)}
      onMouseLeave={() => setShowSnippet(false)}
    >
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Hide this job"
            className="text-gray-300 hover:text-gray-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className={`text-sm font-bold ${fitColor(job.fit)}`}>{job.fit.toFixed(1)}</div>
      </div>
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline text-[#111827] hover:underline decoration-cinema-sage"
      >
        <div className="font-semibold text-base pr-10">{job.company}</div>
        <div className="text-sm">{job.role}</div>
        <div className="text-xs text-gray-500 no-underline">{job.location}</div>
      </a>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px]">
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide">{job.ats_source}</span>
        {job.role_category && job.role_category !== "other" && (
          <span className="px-2 py-0.5 rounded-full bg-cinema-mint/40 text-cinema-pine">{job.role_category}</span>
        )}
        {job.level && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{job.level}</span>
        )}
        {job.years_min !== null && (
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {job.years_max !== null ? `${job.years_min}–${job.years_max}y` : `${job.years_min}+y`}
          </span>
        )}
        {job.salary_min !== null && (
          <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">
            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
          </span>
        )}
        {job.visa_sponsorship === true && (
          <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">visa OK</span>
        )}
        {job.is_international && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">multi-country</span>
        )}
        {job.languages_required.slice(0, 2).map((l) => (
          <span key={l} className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">{l}</span>
        ))}
        <span className="text-gray-400">{relativeDays(job.posted_date)}</span>
      </div>
      <div className="text-xs mt-3 text-gray-600">{job.why}</div>
      {showSnippet && snippet && (
        <div className="pointer-events-none absolute left-4 right-4 top-24 z-30 rounded-lg border bg-white p-3 text-[11px] leading-relaxed text-gray-600 shadow-lg">
          {snippet}
          {job.description && job.description.length > snippet.length ? "..." : ""}
        </div>
      )}

      {(onAdd || onDraft || onAnalyze) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {onAdd && (
            <button
              onClick={onAdd}
              className="text-xs px-3 py-1 border rounded-lg"
              style={{ borderColor: "#1c2620", color: "#1c2620" }}
            >
              Add to tracker
            </button>
          )}
          {onDraft && (
            <button
              onClick={onDraft}
              className="text-xs px-3 py-1 border rounded-lg flex items-center gap-1 text-gray-700 hover:bg-gray-50"
              title="Draft a cover letter for this role"
            >
              ✍️ Draft
            </button>
          )}
          {onAnalyze && status === "idle" && (
            <button
              onClick={() => {
                onAnalyze();
                setExpanded(true);
              }}
              disabled={matchDisabled}
              className="text-xs px-3 py-1 rounded-lg flex items-center gap-1 bg-cinema-moss text-white hover:bg-cinema-pine disabled:opacity-50 disabled:cursor-not-allowed"
              title={matchDisabled ? "AI quota for today reached" : "Run an AI fit analysis"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Analyze fit
            </button>
          )}
          {onAnalyze && (status === "ready" || status === "loading" || status === "error") && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs px-3 py-1 rounded-lg flex items-center gap-1 border border-cinema-sage/50 text-cinema-pine hover:bg-cinema-mint/40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {status === "loading" ? "Analyzing…" : status === "error" ? "Match failed — view" : `AI score ${result!.score.toFixed(1)}`}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}

      {showPanel && (
        <div className="mt-3 border-t pt-3 text-xs space-y-2">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Asking Gemini…
            </div>
          )}
          {status === "error" && matchEntry?.status === "error" && (
            <div className="text-red-600">{matchEntry.error}</div>
          )}
          {status === "ready" && result && (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${fitColor(result.score)}`}>{result.score.toFixed(1)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                  result.verdict === "strong" ? "bg-green-100 text-green-700"
                    : result.verdict === "moderate" ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}>{result.verdict}</span>
                <span className="text-gray-500">{result.experience_match}</span>
              </div>
              {result.reasons.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Why</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
                    {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {result.matched_skills.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Matched</div>
                  <div className="flex flex-wrap gap-1">
                    {result.matched_skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.missing_skills.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Missing</div>
                  <div className="flex flex-wrap gap-1">
                    {result.missing_skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.blockers && result.blockers.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Blockers</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-red-700">
                    {result.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}
              {result.suggestion && (
                <div className="text-gray-700 italic">→ {result.suggestion}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
