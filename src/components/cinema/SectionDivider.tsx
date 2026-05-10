import { cn } from "@/lib/utils";

type Props = {
  /** Top color, then bottom color. */
  from?: "cream" | "mist" | "white" | "moss";
  to?: "cream" | "mist" | "white" | "moss";
  height?: number;
  className?: string;
};

const COLOR_VAR: Record<NonNullable<Props["from"]>, string> = {
  cream: "var(--color-cinema-cream)",
  mist: "var(--color-cinema-mist)",
  white: "#ffffff",
  moss: "var(--color-cinema-moss)",
};

/**
 * Bridge color blocks between sections (e.g. cream → white before
 * a story section). Uses a 1-step linear-gradient — no banding.
 */
export function SectionDivider({
  from = "cream",
  to = "white",
  height = 40,
  className,
}: Props) {
  const style: React.CSSProperties = {
    background: `linear-gradient(to bottom, ${COLOR_VAR[from]} 0%, ${COLOR_VAR[to]} 100%)`,
    height: `${height}px`,
  };
  return <div className={cn("w-full", className)} style={style} aria-hidden />;
}
