import { cn } from "@/lib/utils";

type Props = {
  /** Logos as plain text (or pass <img> nodes). Use text for brand-anonymous demos. */
  logos: Array<{ name: string; src?: string }>;
  className?: string;
};

export function LogoStrip({ logos, className }: Props) {
  return (
    <div className={cn("w-full bg-cinema-cream", className)}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-80">
          {logos.map((l) =>
            l.src ? (
              <img
                key={l.name}
                src={l.src}
                alt={l.name}
                className="h-6 md:h-7 object-contain grayscale opacity-90"
              />
            ) : (
              <span
                key={l.name}
                className="text-cinema-ink-soft text-base md:text-lg font-medium tracking-wide"
              >
                {l.name}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
