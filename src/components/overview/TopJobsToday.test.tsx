/**
 * RTL tests for TopJobsToday (F1 Overview teaser).
 *
 * Coverage:
 *  - Renders top-3 fit-ranked job rows with score + company
 *  - "See all news" link points at /news
 *  - Returns null on empty result (no broken card on Overview)
 *  - Returns null on fetch error
 *  - Shows loading state while the query is pending
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const useNewsJobsMock = vi.fn();
vi.mock("@/lib/news-jobs", () => ({
  useNewsJobs: (...args: unknown[]) => useNewsJobsMock(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

import { TopJobsToday } from "./TopJobsToday";

function job(over: Partial<Record<string, unknown>> = {}) {
  return {
    company: "Acme",
    role: "Founders Associate",
    location: "Berlin",
    url: "https://acme.test/job",
    fit: 8.4,
    matched: [],
    why: "",
    role_category: "founders-associate",
    ats_source: "greenhouse",
    posted_date: null,
    is_remote: false,
    description: null,
    requirements: null,
    years_min: null,
    years_max: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    languages_required: [],
    level: null,
    country: null,
    city: null,
    visa_sponsorship: null,
    is_international: false,
    jobTokens: new Set<string>(),
    reqTokens: new Set<string>(),
    ...over,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("TopJobsToday", () => {
  test("renders fit-ranked rows + See all news link", () => {
    useNewsJobsMock.mockReturnValue({
      data: [
        job({ role: "Founders Associate", company: "Acme", fit: 8.4 }),
        job({ role: "BizOps Lead", company: "Beta", fit: 7.9 }),
        job({ role: "Strategy Analyst", company: "Gamma", fit: 7.1 }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopJobsToday />);
    expect(screen.getByText("Founders Associate")).toBeInTheDocument();
    expect(screen.getByText("BizOps Lead")).toBeInTheDocument();
    expect(screen.getByText("8.4")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /See all news/i });
    expect(link).toHaveAttribute("href", "/news");
  });

  test("renders nothing when the feed is empty", () => {
    useNewsJobsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    const { container } = render(<TopJobsToday />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing on fetch error", () => {
    useNewsJobsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    const { container } = render(<TopJobsToday />);
    expect(container).toBeEmptyDOMElement();
  });

  test("shows loading state while pending", () => {
    useNewsJobsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(<TopJobsToday />);
    expect(screen.getByText(/Loading today's roles/i)).toBeInTheDocument();
  });

  test("requests the 'today' bucket with topN=3", () => {
    useNewsJobsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopJobsToday />);
    expect(useNewsJobsMock).toHaveBeenCalledWith("today", 3);
  });
});
