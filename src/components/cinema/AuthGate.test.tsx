/**
 * RTL tests for AuthGate — anonymous redirect + signed-in pass-through.
 *
 * Owned by A; tests by B per the cross-session pattern.
 *
 * Coverage:
 *  - Anonymous + non-public path → navigate to /login
 *  - Anonymous + public path (/, /jobs, /login, /email-oauth-callback*) → no navigate
 *  - Signed-in + non-public path → no navigate (pass-through)
 *  - onAuthChange signs user out on a protected path → navigate to /login
 *  - Initial render returns null (no DOM)
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let mockPath = "/";
const mockNavigate = vi.fn();
const mockGetCurrentUserId = vi.fn();
const mockOnAuthChange = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: mockPath } }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
  onAuthChange: (cb: (id: string | null) => void) => mockOnAuthChange(cb),
}));

import { AuthGate } from "./AuthGate";

beforeEach(() => {
  mockPath = "/";
  mockNavigate.mockReset();
  mockGetCurrentUserId.mockReset().mockResolvedValue(null);
  mockUnsubscribe.mockReset();
  mockOnAuthChange.mockReset().mockReturnValue(mockUnsubscribe);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthGate — render", () => {
  test("renders nothing (returns null)", () => {
    mockPath = "/";
    const { container } = render(<AuthGate />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AuthGate — anonymous", () => {
  test("anonymous on /profile → navigate to /login", async () => {
    mockPath = "/profile";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });
  });

  test("anonymous on / does NOT navigate (public)", async () => {
    mockPath = "/";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("anonymous on /jobs does NOT navigate (public)", async () => {
    mockPath = "/jobs";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("anonymous on /login does NOT navigate (avoid loop)", async () => {
    mockPath = "/login";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("anonymous on /email-oauth-callback does NOT navigate (public)", async () => {
    mockPath = "/email-oauth-callback";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("anonymous on /email-oauth-callback?code=... also public", async () => {
    mockPath = "/email-oauth-callback/inner";
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("AuthGate — signed-in", () => {
  test("signed-in on /profile → no navigate (pass-through)", async () => {
    mockPath = "/profile";
    mockGetCurrentUserId.mockResolvedValueOnce("u-abc");
    render(<AuthGate />);
    await new Promise((r) => setTimeout(r, 30));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("AuthGate — auth-change", () => {
  test("sign-out on protected path → navigate to /login", async () => {
    mockPath = "/profile";
    mockGetCurrentUserId.mockResolvedValueOnce("u-abc");
    render(<AuthGate />);
    await waitFor(() => expect(mockOnAuthChange).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    const cb = mockOnAuthChange.mock.calls[0][0] as (id: string | null) => void;
    cb(null);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });
  });
});
