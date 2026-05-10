import { createFileRoute } from "@tanstack/react-router";

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
          "Your operator-track profile: target role, geography, strengths, gaps, and recommended next moves. Drives every fit-score Buddy computes.",
      },
    ],
  }),
});

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=80";

function ProfilePage() {
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
            Tell Buddy what you actually want — the role you're after, the
            cities you'd consider, the strengths you bring, the gaps you'd like
            to close. Every fit-score, every CV grade, every "skip this one"
            verdict starts here.
          </>
        }
        cta={
          <>
            <PillLink href="/#profile">Edit on Overview</PillLink>
            <PillLink href="/cv" variant="soft">
              Upload CV instead
            </PillLink>
          </>
        }
      />

      <SectionDivider from="cream" to="white" />

      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 grid grid-cols-1 md:grid-cols-3 gap-6">
          <RevealOnScroll>
            <GlassCard variant="cream" padding="lg" className="h-full">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
                01 — Where you want to land
              </div>
              <h2 className="text-cinema-h2 mb-3">Target role + geo.</h2>
              <p className="text-cinema-body">
                Pick the operator-track buckets that fit (Founders Associate,
                BizOps, Strategy, BD, Chief of Staff, Investment Analyst) and
                the cities you'd consider. Buddy filters the entire 9,980-row
                feed against this before grading anything.
              </p>
            </GlassCard>
          </RevealOnScroll>

          <RevealOnScroll delay={80}>
            <GlassCard variant="cream" padding="lg" className="h-full">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
                02 — What you bring
              </div>
              <h2 className="text-cinema-h2 mb-3">Strengths + story.</h2>
              <p className="text-cinema-body">
                A short paragraph about your background plus a few honest
                strengths. Buddy uses these in the cover-letter drafts so they
                read like you, not like a template.
              </p>
            </GlassCard>
          </RevealOnScroll>

          <RevealOnScroll delay={160}>
            <GlassCard variant="cream" padding="lg" className="h-full">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
                03 — What you'd like to close
              </div>
              <h2 className="text-cinema-h2 mb-3">Gaps + nudges.</h2>
              <p className="text-cinema-body">
                Name the gaps that worry you (e.g. "no SaaS sales rep
                experience"). Buddy nudges you toward roles that build those
                muscles — and is honest about the ones that won't.
              </p>
            </GlassCard>
          </RevealOnScroll>
        </div>
      </section>

      <SectionDivider from="white" to="cream" />

      <section className="bg-cinema-cream">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24">
          <RevealOnScroll>
            <GlassPanel className="md:flex md:items-center md:justify-between gap-12">
              <div className="max-w-xl">
                <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
                  Faster path
                </div>
                <h2 className="text-cinema-h1 mb-4">Or just upload the CV.</h2>
                <p className="text-cinema-body">
                  Buddy will read it, propose a profile, and you tweak from
                  there. About 30 seconds.
                </p>
              </div>
              <div className="mt-8 md:mt-0 flex flex-wrap gap-3">
                <PillLink href="/cv">Upload CV</PillLink>
                <PillLink href="/" variant="soft">
                  Back to Overview
                </PillLink>
              </div>
            </GlassPanel>
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
