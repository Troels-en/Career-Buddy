import * as React from "react";

import { cn } from "@/lib/utils";

import { GlassCard, GlassCardInner } from "./GlassCard";

type ColumnSpec = {
  /** Column heading (eyebrow style). */
  title?: string;
  /** Inner content — usually a list of links or sub-cards. */
  body: React.ReactNode;
};

type Props = {
  /** Backdrop image URL — same warm-cinematic palette as hero. */
  image: string;
  /** Brand mark (slot — render an SVG/text). */
  brand?: React.ReactNode;
  /** Up to four content columns rendered as warm-glass cards. */
  columns: ColumnSpec[];
  /** Footer-line content (legal, certs, social). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * The signature "mega-footer" cluster from 11x: a horizontal row of
 * warm-glass cards floating over a cinematic photo, plus a small brand
 * card on the far left and an optional footer line below.
 *
 * Renders 100vh tall on desktop, scaled down on mobile (cards stack).
 */
export function FloatingCardCluster({
  image,
  brand,
  columns,
  footer,
  className,
}: Props) {
  const photoStyle: React.CSSProperties = {
    backgroundImage: `url("${image}")`,
  };
  return (
    <section
      className={cn("relative w-full overflow-hidden", className)}
      style={{ minHeight: "100vh" }}
    >
      <div
        className="absolute inset-0 bg-cinema-moss"
        style={{
          ...photoStyle,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        role="presentation"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-10 flex flex-col h-full min-h-screen">
        <div className="grow" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {brand && (
            <GlassCard variant="warm" padding="lg" className="md:col-span-3">
              {brand}
            </GlassCard>
          )}
          {columns.map((col, idx) => (
            <GlassCard
              key={idx}
              variant="warm"
              padding="md"
              className={cn(
                brand ? "md:col-span-3" : "md:col-span-4",
                "min-h-[10rem]",
              )}
            >
              {col.title && (
                <div className="text-cinema-eyebrow text-cinema-ink/70 mb-3">
                  {col.title}
                </div>
              )}
              <GlassCardInner>{col.body}</GlassCardInner>
            </GlassCard>
          ))}
        </div>

        {footer && (
          <div className="mt-6 text-cinema-cream/80 text-base flex flex-wrap items-center gap-x-6 gap-y-2">
            {footer}
          </div>
        )}
      </div>
    </section>
  );
}
