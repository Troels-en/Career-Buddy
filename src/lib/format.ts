/**
 * Formatting helpers lifted from CareerBuddy.tsx.
 *
 * Pure functions returning strings (mostly Tailwind class names or
 * human-readable labels). No React, no DOM, no localStorage.
 */

export type ApplicationStatus =
  | "applied"
  | "interview-1"
  | "interview-2"
  | "rejected"
  | "offer"
  | "follow-up-needed"
  | "confirmation";

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  applied: "bg-gray-100 text-gray-700",
  "interview-1": "bg-blue-100 text-blue-800",
  "interview-2": "bg-blue-200 text-blue-900",
  rejected: "bg-red-100 text-red-700",
  offer: "bg-green-100 text-green-700",
  "follow-up-needed": "bg-yellow-100 text-yellow-800",
  confirmation: "bg-gray-50 text-gray-600",
};

/** Tailwind class string for an application-status pill. */
export function statusBadge(s: ApplicationStatus): string {
  return STATUS_BADGE[s];
}

/** Tailwind text-color class for a fit score 1.0..9.9. */
export function fitColor(f: number): string {
  if (f >= 8.0) return "text-green-600";
  if (f >= 5.0) return "text-yellow-600";
  return "text-red-600";
}

/** YYYY-MM-DD for the current local day, used as a "applied today" default. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "€80–120k" or "$50k+" — compact range formatter for the role card.
 * No currency symbol when currency is unknown.
 */
export function formatSalary(
  min: number,
  max: number | null,
  currency: string | null,
): string {
  const sym =
    currency === "EUR"
      ? "€"
      : currency === "GBP"
        ? "£"
        : currency === "USD"
          ? "$"
          : "";
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (max !== null && max > min) return `${sym}${fmt(min)}–${fmt(max)}`;
  return `${sym}${fmt(min)}+`;
}

/** "today" / "1 day ago" / "Nd ago" / "Nmo ago" / "Ny ago". */
export function relativeDays(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
