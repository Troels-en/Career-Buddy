import { cn } from "@/lib/utils";

type Props = {
  value: string;
  label: string;
  /** When `dark`, intended to sit on a glass-card-dark surface. */
  tone?: "light" | "dark";
  className?: string;
};

export function StatBlock({ value, label, tone = "light", className }: Props) {
  const valueColor = tone === "dark" ? "text-cinema-cream" : "text-cinema-ink";
  const labelColor =
    tone === "dark" ? "text-cinema-cream/75" : "text-cinema-ink-soft";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "font-semibold leading-none tracking-tight",
          "text-5xl md:text-6xl",
          valueColor,
        )}
      >
        {value}
      </div>
      <div className={cn("text-cinema-body max-w-md", labelColor)}>{label}</div>
    </div>
  );
}
