import { ArrowUpRight } from "lucide-react";

type Props = {
  message: string;
  href?: string;
  cta?: string;
};

export function PromoBar({ message, href, cta = "See how" }: Props) {
  const content = (
    <span className="inline-flex items-center gap-2 text-cinema-cream/95">
      {message}
      {href && (
        <span className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
          {cta} <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      )}
    </span>
  );
  return (
    <div className="w-full bg-cinema-moss text-cinema-cream text-base">
      <div className="max-w-7xl mx-auto px-4 py-2.5 text-center">
        {href ? (
          <a href={href} className="no-underline">
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
