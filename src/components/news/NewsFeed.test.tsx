/**
 * RTL tests for NewsFeed (F1 /news feed body).
 *
 * Coverage:
 *  - 3 bucket tabs render; default is Today
 *  - Tab click switches the active bucket + fires telemetry
 *  - Loading / error / empty states
 *  - Job rows render from the fit-ranked result
 *  - feed_view telemetry fires on mount
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const useNewsJobsMock = vi.fn();
const bumpFeedViewMock = vi.fn();
const useFeedStateMock = vi.fn();
vi.mock("@/lib/news-jobs", () => ({
  useNewsJobs: (...args: unknown[]) => useNewsJobsMock(...args),
  bumpFeedView: () => bumpFeedViewMock(),
  useFeedState: () => useFeedStateMock(),
}));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { NewsFeed } from "./NewsFeed";

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

beforeEach(() => {
  useNewsJobsMock.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });
  useFeedStateMock.mockReturnValue({ data: null, isFetched: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewsFeed — tabs", () => {
  test("renders 3 bucket tabs", () => {
    render(<NewsFeed />);
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "This week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New since last visit/i }),
    ).toBeInTheDocument();
  });

  test("defaults to the Today bucket", () => {
    render(<NewsFeed />);
    expect(useNewsJobsMock).toHaveBeenCalledWith("today", 10);
  });

  test("clicking 'This week' switches bucket + fires telemetry", async () => {
    const user = userEvent.setup();
    render(<NewsFeed />);
    await user.click(screen.getByRole("button", { name: "This week" }));
    expect(useNewsJobsMock).toHaveBeenLastCalledWith("week", 10);
    expect(trackMock).toHaveBeenCalledWith("feed_tab_switch", { tab: "week" });
  });
});

describe("NewsFeed — states", () => {
  test("loading state", () => {
    useNewsJobsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(<NewsFeed />);
    expect(screen.getByText(/Loading top roles/i)).toBeInTheDocument();
  });

  test("error state", () => {
    useNewsJobsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    render(<NewsFeed />);
    expect(screen.getByText(/Couldn't load the feed/i)).toBeInTheDocument();
  });

  test("empty state", () => {
    render(<NewsFeed />);
    expect(screen.getByText(/Nothing new here yet/i)).toBeInTheDocument();
  });

  test("renders job rows from the ranked result", () => {
    useNewsJobsMock.mockReturnValue({
      data: [job({ role: "BizOps Lead", company: "Beta" })],
      isLoading: false,
      isError: false,
    });
    render(<NewsFeed />);
    expect(screen.getByText("BizOps Lead")).toBeInTheDocument();
  });
});

describe("NewsFeed — telemetry", () => {
  test("fires feed_view on mount", () => {
    render(<NewsFeed />);
    expect(trackMock).toHaveBeenCalledWith("feed_view");
  });
});

describe("NewsFeed — feed-state anchor bump", () => {
  test("bumps the anchor once feed-state has been fetched", () => {
    useFeedStateMock.mockReturnValue({ data: null, isFetched: true });
    render(<NewsFeed />);
    expect(bumpFeedViewMock).toHaveBeenCalledTimes(1);
  });

  test("does NOT bump while feed-state is still loading", () => {
    useFeedStateMock.mockReturnValue({ data: undefined, isFetched: false });
    render(<NewsFeed />);
    expect(bumpFeedViewMock).not.toHaveBeenCalled();
  });
});
