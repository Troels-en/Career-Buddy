/**
 * RTL tests for /email-oauth-callback (round-14 A ship).
 *
 * Owned by A; tests by B per the cross-session pattern.
 * Filename prefixed `-` so TanStack Start's route generator
 * ignores it.
 *
 * Coverage:
 *  - Missing code/state in URL → error message
 *  - Happy path → "Connected" + navigate to /profile#email after timeout
 *  - SDK error → error surface
 *  - Body `{error: ...}` → error surface
 *  - Invoke throws → error fallback
 *  - Provider query-param defaults to gmail when absent
 *  - Provider=outlook recognized
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type * as React from "react";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (opts: Record<string, unknown>) => ({
    options: opts,
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/cinema", () => ({
  GlassPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="glass-panel">{children}</div>
  ),
}));

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (fn: string, opts: unknown) => mockInvoke(fn, opts),
    },
  },
}));

import { Route } from "./email-oauth-callback";

type Comp = () => React.ReactElement;

function renderCallback(url: string) {
  // Stub window.location with the test URL so readParams() picks it up.
  const stub = new URL(url, "http://localhost");
  delete (window as unknown as { location?: unknown }).location;
  (window as unknown as { location: { href: string } }).location = {
    href: stub.href,
  };
  const opts = (Route as unknown as { options: { component: Comp } }).options;
  return render(<opts.component />);
}

const originalLocation = window.location;

beforeEach(() => {
  mockNavigate.mockReset();
  mockInvoke.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  (window as unknown as { location: Location }).location = originalLocation;
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("email-oauth-callback — error paths", () => {
  test("missing code → 'Missing OAuth code or state' error", async () => {
    renderCallback("/email-oauth-callback?state=xyz");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Missing OAuth code or state/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("missing state → 'Missing OAuth code or state' error", async () => {
    renderCallback("/email-oauth-callback?code=abc");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Missing OAuth code or state/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
  });

  test("SDK error → surfaced in error panel", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "edge function down" },
    });
    renderCallback("/email-oauth-callback?code=abc&state=xyz");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/edge function down/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
    expect(screen.getByText(/Couldn't connect your inbox/i)).toBeInTheDocument();
  });

  test("body {error: ...} → surfaced", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: "invalid or expired state token" },
      error: null,
    });
    renderCallback("/email-oauth-callback?code=abc&state=xyz");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/invalid or expired state token/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
  });

  test("invoke throws → fallback error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("network"));
    renderCallback("/email-oauth-callback?code=abc&state=xyz");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/network/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
  });
});

describe("email-oauth-callback — happy path", () => {
  test("success → Connected message + navigate after 1.5s", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, provider: "gmail", email: "u@x.com" },
      error: null,
    });
    renderCallback("/email-oauth-callback?code=abc&state=xyz");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Connected\. Redirecting/i)).toBeInTheDocument();
      },
      { timeout: 2000, interval: 50 },
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1600);
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/profile", hash: "email" });
    });
  });
});

describe("email-oauth-callback — provider routing", () => {
  test("missing provider param defaults to gmail", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    renderCallback("/email-oauth-callback?code=abc&state=xyz");
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalled(), {
      timeout: 2000,
      interval: 50,
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      "email-oauth-callback",
      expect.objectContaining({
        body: expect.objectContaining({ provider: "gmail" }),
      }),
    );
  });

  test("provider=outlook recognized", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    renderCallback("/email-oauth-callback?code=abc&state=xyz&provider=outlook");
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalled(), {
      timeout: 2000,
      interval: 50,
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      "email-oauth-callback",
      expect.objectContaining({
        body: expect.objectContaining({ provider: "outlook" }),
      }),
    );
  });
});
