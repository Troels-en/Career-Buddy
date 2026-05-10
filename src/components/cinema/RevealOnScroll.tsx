import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Props = {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
  /** Delay in ms before the reveal starts after intersection. */
  delay?: number;
  /** Root margin for the IntersectionObserver — larger pre-loads earlier. */
  rootMargin?: string;
};

/**
 * Single-shot fade + 24px rise on viewport entry.
 * Reduced-motion users get the final state instantly (CSS handles it).
 */
export function RevealOnScroll({
  as = "div",
  className,
  children,
  delay = 0,
  rootMargin = "0px 0px -10% 0px",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced-motion users + no-IO browsers: snap to final state.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            window.setTimeout(() => target.classList.add("is-visible"), delay);
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    obs.observe(el);
    // Defensive fallback — if the element is already in the viewport
    // at mount (tall screens / programmatic scroll-test) IO sometimes
    // doesn't fire a synthetic entry. Force-reveal after 1200ms to
    // avoid permanently invisible content.
    const fallback = window.setTimeout(() => el.classList.add("is-visible"), 1200);
    return () => {
      obs.disconnect();
      window.clearTimeout(fallback);
    };
  }, [delay, rootMargin]);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref as React.Ref<HTMLElement>} className={cn("reveal-on-scroll", className)}>
      {children}
    </Tag>
  );
}
