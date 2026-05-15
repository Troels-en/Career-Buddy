import { ArrowUpRight, Loader2 } from "lucide-react";

import { useNewsJobs } from "@/lib/news-jobs";
import { track } from "@/lib/telemetry";

/**
 * F1 — compact Overview teaser: top 3 best-fit roles from today,
 * with a link through to the full /news feed. Keeps the daily-return
 * hook visible on the landing page without the full feed weight.
 */
export function TopJobsToday() {
  const { data: jobs, isLoading, isError } = useNewsJobs("today", 3);

  // Silent when there's nothing fresh or the fetch failed — the
  // Overview shouldn't show an empty/broken card.
  if (isError || (!isLoading && (!jobs || jobs.length === 0))) {
    return null;
  }

  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 pt-10">
      <div className="rounded-glass border border-cinema-mint bg-white/70 p-6">
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-cinema-h2">Fresh today, picked for you</h2>
          <a
            href="/news"
            onClick={() => void track("feed_card_click", { from: "overview_teaser" })}
            className="inline-flex items-center gap-1 text-base text-cinema-pine hover:text-cinema-ink no-underline"
          >
            See all news <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-cinema-ink-mute py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading today's roles…
          </div>
        ) : (
          <ul className="space-y-2">
            {jobs!.map((job, i) => (
              <li key={`${job.url}-${i}`}>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    void track("feed_card_click", {
                      from: "overview_teaser",
                      jobUrl: job.url,
                    })
                  }
                  className="flex items-center gap-3 rounded-glass border border-cinema-mint bg-white px-4 py-3 no-underline hover:bg-cinema-mint/30 transition-colors"
                >
                  <span className="inline-flex items-center justify-center w-10 shrink-0 text-base font-semibold text-cinema-pine">
                    {job.fit.toFixed(1)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base text-cinema-ink truncate">
                      {job.role}
                    </span>
                    <span className="block text-cinema-caption truncate">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-cinema-ink-mute" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
