import { createFileRoute } from "@tanstack/react-router";

import { CinematicHero, SectionDivider } from "@/components/cinema";
import { JobsFeed } from "@/components/jobs/JobsFeed";
import { usePhoto } from "@/lib/cinema-theme";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  head: () => ({
    meta: [
      { title: "Career-Buddy — All live jobs" },
      {
        name: "description",
        content:
          "Every live operator-track role in one filterable feed. Thousands of openings across hundreds of venture-backed firms and their portfolio companies, refreshed every night.",
      },
    ],
  }),
});

/**
 * Phase 3 — `/jobs` now mounts the standalone `<JobsFeed />` from
 * `src/components/jobs/`. No more `<CareerBuddy rolesOnly />`
 * placeholder coupling: this route fetches its own data, owns its own
 * filter/sort state, and renders the role grid via the extracted
 * `JobCard` + `FilterBar` components.
 *
 * Browse + filter + sort lives here; AI fit-analysis + tracker stay
 * on Overview (`/`) where the monolith still owns the profile +
 * applications state.
 */
function JobsPage() {
  const heroImage = usePhoto("jobs");
  return (
    <div className="bg-cinema-cream text-cinema-ink">
      <CinematicHero
        image={heroImage}
        altText="All live jobs — workspace photography that follows your selected track"
        eyebrow="All live jobs"
        scrollVh={5}
        headline={<>Every role we found.</>}
        subhead={
          <>
            One filterable feed across 209 venture-backed firms and the
            companies they fund. Filter by role, level, country, ATS,
            languages, salary, recency, remote, visa. Sort by best fit
            against your CV.
          </>
        }
      />
      <SectionDivider from="cream" to="white" />
      <div className="bg-white">
        <JobsFeed />
      </div>
    </div>
  );
}
