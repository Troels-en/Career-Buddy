import * as React from "react";

import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement>;

/**
 * Large hero-overlay container — heavier blur, larger radius.
 * Use for the single dominant card on a page (e.g. the "Hire our
 * Digital Workers" CTA card on the 11x landing).
 */
export function GlassPanel({ className, children, ...rest }: Props) {
  return (
    <div className={cn("glass-panel-heavy p-8 md:p-12", className)} {...rest}>
      {children}
    </div>
  );
}
