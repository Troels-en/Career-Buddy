import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  fitColor,
  formatSalary,
  relativeDays,
  statusBadge,
  todayISO,
  type ApplicationStatus,
} from "./format";

// ---------------------------------------------------------------------------
// statusBadge
// ---------------------------------------------------------------------------

describe("statusBadge", () => {
  const cases: Array<[ApplicationStatus, RegExp]> = [
    ["applied", /bg-gray-100/],
    ["interview-1", /bg-blue-100/],
    ["interview-2", /bg-blue-200/],
    ["rejected", /bg-red-100/],
    ["offer", /bg-green-100/],
    ["follow-up-needed", /bg-yellow-100/],
    ["confirmation", /bg-gray-50/],
  ];
  for (const [status, pattern] of cases) {
    test(`${status} returns matching class`, () => {
      expect(statusBadge(status)).toMatch(pattern);
    });
  }

  test("returns text colour for every status", () => {
    const all: ApplicationStatus[] = [
      "applied",
      "interview-1",
      "interview-2",
      "rejected",
      "offer",
      "follow-up-needed",
      "confirmation",
    ];
    for (const s of all) {
      expect(statusBadge(s)).toMatch(/\btext-/);
    }
  });
});

// ---------------------------------------------------------------------------
// fitColor
// ---------------------------------------------------------------------------

describe("fitColor", () => {
  test("8.0+ → green", () => {
    expect(fitColor(8.0)).toBe("text-green-600");
    expect(fitColor(9.9)).toBe("text-green-600");
  });

  test("5.0..7.9 → yellow", () => {
    expect(fitColor(5.0)).toBe("text-yellow-600");
    expect(fitColor(7.9)).toBe("text-yellow-600");
  });

  test("<5.0 → red", () => {
    expect(fitColor(4.9)).toBe("text-red-600");
    expect(fitColor(1.0)).toBe("text-red-600");
  });
});

// ---------------------------------------------------------------------------
// todayISO
// ---------------------------------------------------------------------------

describe("todayISO", () => {
  test("returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// formatSalary
// ---------------------------------------------------------------------------

describe("formatSalary", () => {
  test("EUR range", () => {
    expect(formatSalary(80_000, 120_000, "EUR")).toBe("€80k–120k");
  });

  test("GBP range", () => {
    expect(formatSalary(50_000, 70_000, "GBP")).toBe("£50k–70k");
  });

  test("USD range", () => {
    expect(formatSalary(60_000, 90_000, "USD")).toBe("$60k–90k");
  });

  test("unknown currency drops symbol", () => {
    expect(formatSalary(50_000, 70_000, null)).toBe("50k–70k");
    expect(formatSalary(50_000, 70_000, "JPY")).toBe("50k–70k");
  });

  test("max=null → 'min+' suffix", () => {
    expect(formatSalary(50_000, null, "EUR")).toBe("€50k+");
  });

  test("max <= min collapses to 'min+'", () => {
    expect(formatSalary(60_000, 50_000, "EUR")).toBe("€60k+");
    expect(formatSalary(60_000, 60_000, "EUR")).toBe("€60k+");
  });

  test("sub-1000 numbers don't get k suffix", () => {
    expect(formatSalary(900, 950, "EUR")).toBe("€900–950");
  });

  test("rounds to nearest thousand", () => {
    expect(formatSalary(80_400, 119_500, "EUR")).toBe("€80k–120k");
  });
});

// ---------------------------------------------------------------------------
// relativeDays
// ---------------------------------------------------------------------------

describe("relativeDays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("null → em-dash", () => {
    expect(relativeDays(null)).toBe("—");
  });

  test("today", () => {
    expect(relativeDays("2026-05-10")).toBe("today");
  });

  test("1 day ago (singular)", () => {
    expect(relativeDays("2026-05-09")).toBe("1 day ago");
  });

  test("multi days ago", () => {
    expect(relativeDays("2026-05-05")).toBe("5 days ago");
  });

  test("month boundary — 30..364 days", () => {
    expect(relativeDays("2026-04-01")).toMatch(/^\d+mo ago$/);
  });

  test("years boundary — 365+ days", () => {
    expect(relativeDays("2024-05-10")).toMatch(/^\d+y ago$/);
  });
});
