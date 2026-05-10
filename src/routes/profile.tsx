import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, Upload } from "lucide-react";

import {
  CinematicHero,
  GlassCard,
  GlassPanel,
  PillLink,
  RevealOnScroll,
  SectionDivider,
} from "@/components/cinema";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Career-Buddy — Profile" },
      {
        name: "description",
        content:
          "Your operator-track profile: tracks you're chasing, skills extracted from your CV, target geography, the experience that matters. Drives every fit-score Buddy computes.",
      },
    ],
  }),
});

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=80";

// Placeholder track set — Phase 1 will wire these to user_tracks
// in Supabase + drive the track-based theming in Phase 4. For now
// a multi-select stored in localStorage.
const TRACKS = [
  { id: "startup-early", label: "Startup · early-stage", hint: "Founders Associate, BizOps, founding ops" },
  { id: "startup-late",  label: "Startup · scale",        hint: "BizOps, Strategy, Chief of Staff" },
  { id: "vc",            label: "Venture Capital",        hint: "Investment Analyst / Associate" },
  { id: "consulting",    label: "Consulting",             hint: "MBB, Tier-2, boutique strategy" },
  { id: "ib",            label: "Investment Banking",     hint: "M&A, Capital Markets, Coverage" },
  { id: "pe",            label: "Private Equity",         hint: "Pre-MBA, growth, buyout" },
  { id: "operator",      label: "Operator-track generic", hint: "any of the above, role-shaped not industry-shaped" },
];

const SKILLS_PLACEHOLDER = [
  "B2B sales — placeholder, will be extracted from your CV",
  "Structured thinking — placeholder",
  "Python (basic) — placeholder",
  "SQL — placeholder",
  "Financial modelling — placeholder",
];

function ProfilePage() {
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("career-buddy-tracks-v1");
      if (raw) setSelectedTracks(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleTrack(id: string) {
    const next = selectedTracks.includes(id)
      ? selectedTracks.filter((t) => t !== id)
      : [...selectedTracks, id];
    setSelectedTracks(next);
    try {
      localStorage.setItem("career-buddy-tracks-v1", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-cinema-cream text-cinema-ink">
      <CinematicHero
        image={HERO_IMAGE}
        altText="Profile — soft forest light, the buddy that knows where you want to go"
        eyebrow="Profile"
        scrollVh={10}
        headline={<>The shape of your search.</>}
        subhead={
          <>
            Pick the tracks you'd actually consider, drop your CV so Buddy
            can pull the skills out, and answer a few short questions when
            it asks. Every fit-score and every cover-letter draft starts
            from this page.
          </>
        }
        cta={
          <>
            <PillLink href="#tracks">Pick tracks</PillLink>
            <PillLink href="#cv-upload" variant="soft">
              Upload CV
            </PillLink>
          </>
        }
      />

      <SectionDivider from="cream" to="white" />

      {/* Section 1 — Tracks */}
      <section id="tracks" className="bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
          <RevealOnScroll>
            <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
              01 — Tracks
            </div>
            <h2 className="text-cinema-h1 mb-4 max-w-3xl">
              <span className="cinema-headline-underline">
                Which paths
              </span>{" "}
              are you actually open to?
            </h2>
            <p className="text-cinema-body max-w-2xl mb-10">
              Pick one or more. Buddy uses these to filter the live job feed,
              tune cover-letter drafts, and (soon) re-skin the whole app to
              match the world you're heading into. Toggle anytime.
            </p>
          </RevealOnScroll>

          <RevealOnScroll>
            <div className="flex flex-wrap gap-3">
              {TRACKS.map((t) => {
                const active = selectedTracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTrack(t.id)}
                    className={[
                      "rounded-full border px-5 py-3 text-base transition-colors text-left max-w-md",
                      active
                        ? "bg-cinema-moss text-cinema-cream border-cinema-moss"
                        : "bg-cinema-mist border-cinema-mint text-cinema-ink hover:bg-cinema-mint/60",
                    ].join(" ")}
                  >
                    <div className="font-semibold">{t.label}</div>
                    <div
                      className={[
                        "text-base mt-0.5",
                        active ? "text-cinema-cream/80" : "text-cinema-ink-mute",
                      ].join(" ")}
                    >
                      {t.hint}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-cinema-caption mt-6">
              Saved locally for now. Phase 1 will sync this to your account so
              themes + recommendations follow you across devices.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      <SectionDivider from="white" to="cream" />

      {/* Section 2 — Skills */}
      <section id="skills" className="bg-cinema-cream scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
          <RevealOnScroll className="md:col-span-7">
            <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
              02 — Skills
            </div>
            <h2 className="text-cinema-h1 mb-4">
              <span className="cinema-headline-underline">
                Skills Buddy reads
              </span>{" "}
              from your CV.
            </h2>
            <p className="text-cinema-body mb-4">
              Drop the CV once. Buddy extracts work history, named tools,
              named skills, education. You can correct any of it inline —
              the model is honest about what it found and what it inferred.
            </p>
            <p className="text-cinema-body">
              When something looks thin, Buddy asks. Example: "I see Python on
              your CV — what was the most recent project?" Use the mic next
              to any field if you'd rather speak than type (Web Speech API,
              free, browser-native — coming in Phase 1).
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={120} className="md:col-span-5">
            <GlassCard variant="cream" padding="lg">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
                Placeholder skills (until you upload)
              </div>
              <ul className="space-y-2">
                {SKILLS_PLACEHOLDER.map((s) => (
                  <li
                    key={s}
                    className="text-base text-cinema-ink-soft flex items-start gap-2"
                  >
                    <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-cinema-pine flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-cinema-mint px-4 py-2 text-base text-cinema-ink-mute cursor-not-allowed opacity-70"
                title="Voice input ships in Phase 1"
              >
                <Mic className="w-4 h-4" />
                Speak instead (Phase 1)
              </button>
            </GlassCard>
          </RevealOnScroll>
        </div>
      </section>

      {/* Section 3 — CV upload */}
      <section id="cv-upload" className="bg-cinema-cream scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 pb-24">
          <RevealOnScroll>
            <GlassPanel className="md:flex md:items-center md:justify-between gap-12">
              <div className="max-w-xl">
                <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
                  03 — CV
                </div>
                <h2 className="text-cinema-h1 mb-4">Drop your CV here.</h2>
                <p className="text-cinema-body mb-2">
                  PDF or .docx, parsed in your browser, never uploaded raw.
                  Buddy reads it once and proposes a skills + experience
                  profile you can edit.
                </p>
                <p className="text-cinema-caption">
                  Wired to Overview's existing analyze-cv flow — promotion to
                  a fully native Profile control ships in Phase 1.
                </p>
              </div>
              <div className="mt-8 md:mt-0 flex flex-wrap gap-3">
                <PillLink href="/#cv-upload">
                  <Upload className="w-4 h-4" />
                  Upload on Overview
                </PillLink>
                <PillLink href="/buddy" variant="soft">
                  Ask Buddy first
                </PillLink>
              </div>
            </GlassPanel>
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
