/**
 * RTL tests for the /login route (round-14 A ship).
 *
 * Owned by A; tests by B per the cross-session pattern.
 * Filename prefixed `-` so TanStack Start's route generator
 * ignores it (`routeFileIgnorePrefix: "-"`).
 *
 * Coverage:
 *  - Already-signed-in on mount → navigate to /
 *  - onAuthChange fires with id → navigate to /
 *  - Empty email submit → "Email required" error, no SDK call
 *  - Magic-link happy path → "sent" success message + input disabled
 *  - signInWithEmail rejects → error message surfaced
 *  - Google click → signInWithGoogle invoked
 *  - signInWithGoogle rejects → error message in Google section
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const mockGetCurrentUserId = vi.fn();
const mockSignInWithEmail = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockOnAuthChange = vi.fn();
const mockUnsubscribe = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
  signInWithEmail: (email: string) => mockSignInWithEmail(email),
  signInWithGoogle: () => mockSignInWithGoogle(),
  onAuthChange: (cb: (id: string | null) => void) => mockOnAuthChange(cb),
}));

import { Route } from "./login";

type LoginPageComponent = () => React.ReactElement;

function renderLoginPage() {
  const opts = (Route as unknown as { options: { component: LoginPageComponent } }).options;
  return render(<opts.component />);
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockGetCurrentUserId.mockReset().mockResolvedValue(null);
  mockSignInWithEmail.mockReset().mockResolvedValue(undefined);
  mockSignInWithGoogle.mockReset().mockResolvedValue(undefined);
  mockUnsubscribe.mockReset();
  mockOnAuthChange.mockReset().mockReturnValue(mockUnsubscribe);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("login — redirect when already signed in", () => {
  test("getCurrentUserId returns id on mount → navigate to /", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce("u-abc");
    renderLoginPage();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  test("onAuthChange fires with id later → navigate to /", async () => {
    renderLoginPage();
    await waitFor(() => expect(mockOnAuthChange).toHaveBeenCalled());
    const cb = mockOnAuthChange.mock.calls[0][0] as (id: string | null) => void;
    cb("u-late");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });
});

describe("login — magic link", () => {
  test("empty email submit shows error, no SDK call", async () => {
    renderLoginPage();
    const form = screen.getByRole("button", { name: /Send magic link/i }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/Email required/i)).toBeInTheDocument();
    });
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  test("happy path → sent state + input disabled", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    const input = screen.getByLabelText(/Email address/i);
    await user.type(input, "alex@example.com");
    await user.click(screen.getByRole("button", { name: /Send magic link/i }));

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith("alex@example.com");
    });
    await waitFor(() => {
      expect(screen.getByText(/Check your inbox/i)).toBeInTheDocument();
    });
    expect(input).toBeDisabled();
  });

  test("signInWithEmail rejects → error surfaced", async () => {
    mockSignInWithEmail.mockRejectedValueOnce(new Error("rate limited"));
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(/Email address/i), "a@b.c");
    await user.click(screen.getByRole("button", { name: /Send magic link/i }));
    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });
});

describe("login — Google", () => {
  test("click invokes signInWithGoogle", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole("button", { name: /Sign in with Google/i }));
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  test("signInWithGoogle rejects → error message", async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error("provider misconfigured"));
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole("button", { name: /Sign in with Google/i }));
    await waitFor(() => {
      expect(screen.getByText(/provider misconfigured/i)).toBeInTheDocument();
    });
  });
});
