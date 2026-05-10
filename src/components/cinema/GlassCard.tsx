import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "cream" | "warm" | "dark";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  padding?: "sm" | "md" | "lg";
};

const VARIANT_CLASS: Record<Variant, string> = {
  cream: "glass-card",
  warm: "glass-card-warm",
  dark: "glass-card-dark",
};

const PAD_CLASS: Record<NonNullable<Props["padding"]>, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({
  variant = "cream",
  padding = "md",
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(VARIANT_CLASS[variant], PAD_CLASS[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassCardInner({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-card-inner", className)} {...rest}>
      {children}
    </div>
  );
}
