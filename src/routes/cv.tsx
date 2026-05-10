import { createFileRoute } from "@tanstack/react-router";

import {
  CinematicHero,
  GlassCard,
  GlassPanel,
  PillLink,
  RevealOnScroll,
  SectionDivider,
} from "@/components/cinema";

export const Route = createFileRoute("/cv")({
  component: CvPage,
  head: () => ({
    meta: [
      { title: "Career-Buddy — CV" },
      {
        name: "description",
        content:
          "Upload your CV. Buddy reads it once, proposes a profile, then grades every live operator-track role against it.",
      },
    ],
  }),
});

// Sage pine forest — same cool-green direction as the rest of the app.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=80";

function CvPage() {
  return (
    <div className="bg-cinema-cream text-cinema-ink">
      <CinematicHero
        image={HERO_IMAGE}
        altText="CV — soft meadow at dusk, the buddy that reads carefully"
        eyebrow="CV"
        scrollVh={10}
        headline={<>One page Buddy reads carefully.</>}
        subhead={
          <>
            Drop a PDF or .docx. Buddy reads the work history, education,
            strengths and gaps, then writes you a profile you can edit. Every
            role in the live feed is then graded against it — silently, in the
            background, until you ask.
          </>
        }
        cta={
          <>
            <PillLink href="/#cv-upload">Upload on Overview</PillLink>
            <PillLink href="/profile" variant="soft">
              Build profile by hand
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
                01 — What Buddy reads
              </div>
              <h2 className="text-cinema-h2 mb-3">Just the facts.</h2>
              <p className="text-cinema-body">
                Work history, education, named skills, named tools. Buddy
                ignores buzzwords and flowery language; the model is graded on
                signal, not vibes.
              </p>
            </GlassCard>
          </RevealOnScroll>

          <RevealOnScroll delay={80}>
            <GlassCard variant="cream" padding="lg" className="h-full">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
                02 — What it does next
              </div>
              <h2 className="text-cinema-h2 mb-3">Builds your profile.</h2>
              <p className="text-cinema-body">
                Buddy proposes a profile draft (target role, geo, strengths,
                gaps). You review, edit, save. The whole job feed re-grades
                itself the moment you save.
              </p>
            </GlassCard>
          </RevealOnScroll>

          <RevealOnScroll delay={160}>
            <GlassCard variant="cream" padding="lg" className="h-full">
              <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
                03 — What stays private
              </div>
              <h2 className="text-cinema-h2 mb-3">All of it.</h2>
              <p className="text-cinema-body">
                The CV is parsed in your browser before anything leaves. No
                raw PDF is ever stored. The structured profile is yours to
                delete from the Overview at any time.
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
                  Ready
                </div>
                <h2 className="text-cinema-h1 mb-4">Let Buddy take a look.</h2>
                <p className="text-cinema-body">
                  Open Overview, drop the PDF on the upload card, watch your
                  feed get smarter.
                </p>
              </div>
              <div className="mt-8 md:mt-0 flex flex-wrap gap-3">
                <PillLink href="/#cv-upload">Upload on Overview</PillLink>
                <PillLink href="/chat" variant="soft">
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
