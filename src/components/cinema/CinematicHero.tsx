import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** Background image URL — landscape, warm tones, ≥ 16:9. */
  image: string;
  /** Optional alt text for screen-readers (img is decorative — null skips). */
  altText?: string;
  /** Eyebrow above headline (small uppercase). */
  eyebrow?: string;
  /** Display headline ("Be more human."). */
  headline: React.ReactNode;
  /** Optional sub-text under headline. */
  subhead?: React.ReactNode;
  /** CTA slot — render <PillButton/> or <a/>. */
  cta?: React.ReactNode;
  /**
   * Extra height in vh past the standard 100vh. Drives the sticky-scroll
   * effect: photo + headline pin while user scrolls this much before the
   * next section takes over. Default 60.
   */
  scrollVh?: number;
  className?: string;
};

/**
 * Full-bleed cinematic hero with sticky photo + headline.
 *
 * Layout:
 *   <section min-h: 100vh+scrollVh> — relatively positioned scroll track
 *     <div sticky top:0 h:100vh>  — the visible "frame" that pins
 *       <photo absolute inset:0 />
 *       <gradient absolute inset:0 />
 *       <content absolute inset:0 flex items-end> — text in lower-left
 *
 * Pure CSS — no JS parallax. Works without JS, respects reduced-motion.
 */
export function CinematicHero({
  image,
  altText,
  eyebrow,
  headline,
  subhead,
  cta,
  scrollVh = 60,
  className,
}: Props) {
  const wrapperStyle: React.CSSProperties = {
    minHeight: `calc(100vh + ${scrollVh}vh)`,
  };
  const photoStyle: React.CSSProperties = {
    backgroundImage: `url("${image}")`,
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
  };
  return (
    <section
      className={cn("relative w-full bg-cinema-cream overflow-hidden", className)}
      style={wrapperStyle}
      aria-label={altText ?? undefined}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={photoStyle}
          role="presentation"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            // moss top fade → cream bottom fade. Keeps the hero readable
            // and softly merges into the next cream/mist section.
            background:
              "linear-gradient(180deg, rgba(28,38,30,0.45) 0%, rgba(28,38,30,0.10) 38%, rgba(243,247,241,0.0) 75%, rgba(243,247,241,0.85) 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl w-full mx-auto px-6 md:px-12 pb-20 md:pb-28">
            {eyebrow && (
              <div className="text-cinema-eyebrow text-cinema-cream/85 mb-6">
                {eyebrow}
              </div>
            )}
            <h1 className="text-cinema-display text-cinema-cream max-w-5xl">
              <span className="cinema-headline-underline">{headline}</span>
            </h1>
            {subhead && (
              <p className="text-cinema-body text-cinema-cream/85 max-w-xl mt-6">
                {subhead}
              </p>
            )}
            {cta && <div className="mt-8 flex flex-wrap gap-3">{cta}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
