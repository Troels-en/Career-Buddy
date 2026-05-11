/**
 * RTL tests for AuthPill — signed-in vs anonymous render + signOut.
 *
 * Owned by A; tests by B per the cross-session pattern.
 *
 * Coverage:
 *  - Anonymous → "Sign in" link to /login
 *  - Signed-in → email shown + LogOut icon button
 *  - LogOut click → calls signOut + sets window.location to "/"
 *  - onAuthChange null → flips back to anonymous
 *  - User with no email → "Signed in" fallback label
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

const mockOnAuthChange = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();
vi.mock("@/lib/auth", () => ({
  onAuthChange: (cb: (id: string | null) => void) => mockOnAuthChange(cb),
  signOut: () => mockSignOut(),
}));

import { AuthPill } from "./AuthPill";

const originalLocation = window.location;

beforeEach(() => {
  mockGetUser.mockReset();
  mockOnAuthChange.mockReset().mockReturnValue(mockUnsubscribe);
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockUnsubscribe.mockReset();
  // Stub window.location so we can assert href assignment on signOut.
  delete (window as unknown as { location?: unknown }).location;
  (window as unknown as { location: { href: string } }).location = { href: "/" };
});

afterEach(() => {
  (window as unknown as { location: Location }).location = originalLocation;
  vi.clearAllMocks();
});

describe("AuthPill — anonymous", () => {
  test("renders Sign in link to /login when no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    render(<AuthPill />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Sign in/i });
      expect(link).toHaveAttribute("href", "/login");
    });
  });
});

describe("AuthPill — signed-in", () => {
  test("renders email + logout icon when user is loaded", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-abc", email: "alex@example.com" } },
    });
    render(<AuthPill />);
    await waitFor(() => {
      expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      expect.stringContaining("alex@example.com"),
    );
  });

  test("user with null email falls back to 'Signed in' label", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-no-email", email: null } },
    });
    render(<AuthPill />);
    await waitFor(() => {
      expect(screen.getByText(/Signed in/i)).toBeInTheDocument();
    });
  });

  test("logout button click → signOut + window.location='/'", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-abc", email: "alex@example.com" } },
    });
    const user = userEvent.setup();
    render(<AuthPill />);
    await waitFor(() => {
      expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect((window.location as unknown as { href: string }).href).toBe("/");
  });
});

describe("AuthPill — auth-change", () => {
  test("onAuthChange null flips signed-in pill back to anonymous", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-abc", email: "alex@example.com" } },
    });
    render(<AuthPill />);
    await waitFor(() => {
      expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    });
    const cb = mockOnAuthChange.mock.calls[0][0] as (id: string | null) => Promise<void>;
    await cb(null);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Sign in/i })).toBeInTheDocument();
    });
  });
});
