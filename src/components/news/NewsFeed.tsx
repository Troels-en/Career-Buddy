import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { JobCard } from "@/components/jobs/JobCard";
import {
  bumpFeedView,
  useFeedState,
  useNewsJobs,
  type NewsBucket,
} from "@/lib/news-jobs";
import { track } from "@/lib/telemetry";

/**
 * F1 — News v1 feed. Three buckets of top-fit jobs:
 *  - Today: posted/seen in the last 24h
 *  - Week: last 7 days
 *  - New since visit: since the user's server-side last_feed_view_at
 *
 * Ranking is client-side fit-score (same path as JobsFeed). On mount
 * the feed bumps the user's last_feed_view_at so the badge resets.
 */

const TABS: Array<{ key: NewsBucket; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "new_since_visit", label: "New since last visit" },
];

export function NewsFeed() {
  const [bucket, setBucket] = useState<NewsBucket>("today");
  const { data: jobs, isLoading, isError } = useNewsJobs(bucket, 10);
  // Observe the same feed-state query useNewsJobs reads (React Query
  // dedupes by key — one fetch, shared cache).
  const feedState = useFeedState();
  const bumpedRef = useRef(false);

  useEffect(() => {
    void track("feed_view");
  }, []);

  useEffect(() => {
    // Bump the server-side anchor exactly once, and ONLY after the
    // prior anchor has been fetched. By the time feedState.isFetched
    // is true, useNewsJobs has already locked the prior `lastViewAt`
    // into its React Query key, so the current session's
    // new_since_visit query saw the OLD anchor. The bump advances the
    // DB anchor for the NEXT visit without a cancellable timer.
    if (feedState.isFetched && !bumpedRef.current) {
      bumpedRef.current = true;
      void bumpFeedView();
    }
  }, [feedState.isFetched]);

  function switchTab(next: NewsBucket) {
    setBucket(next);
    void track("feed_tab_switch", { tab: next });
  }

  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12">
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={
              bucket === t.key
                ? "px-4 py-2 rounded-full text-base bg-cinema-moss text-cinema-cream transition-colors"
                : "px-4 py-2 rounded-full text-base text-cinema-ink-soft hover:bg-cinema-mint/60 transition-colors"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-cinema-ink-mute py-12">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading top roles…
        </div>
      )}

      {isError && (
        <div className="rounded-glass border border-red-200 bg-red-50 px-4 py-3 text-base text-destructive">
          Couldn't load the feed. Try again in a moment.
        </div>
      )}

      {!isLoading && !isError && jobs && jobs.length === 0 && (
        <div className="rounded-glass border border-cinema-mint bg-white/70 p-8 text-center">
          <div className="text-cinema-h2 mb-1">Nothing new here yet.</div>
          <p className="text-cinema-body">
            No fresh roles in this window. Check the other tabs or come
            back tomorrow — the feed refreshes every night.
          </p>
        </div>
      )}

      {!isLoading && !isError && jobs && jobs.length > 0 && (
        <div className="grid gap-4">
          {jobs.map((job, i) => (
            <JobCard
              key={`${job.url}-${i}`}
              job={job}
              isTop={i === 0}
              onAnalyze={() => {
                void track("feed_card_click", { jobUrl: job.url });
                window.open(job.url, "_blank", "noopener,noreferrer");
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
