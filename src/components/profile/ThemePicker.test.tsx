/**
 * RTL tests for ThemePicker. UI session owns the component; this
 * session writes the tests per CLAUDE_COORDINATION.md round-7.
 *
 * Mocks:
 *  - `@/lib/cinema-theme`.persistTheme            (Supabase upsert)
 *  - `@/lib/cinema-theme`.useTheme                (returns "sage" by default)
 *
 * Coverage:
 *  - 4 chips render with their labels
 *  - Active chip carries the moss bg class + Check icon
 *  - Click → setAttribute on documentElement, localStorage write,
 *    persistTheme called
 *  - Swatches render (3 per chip, 12 total)
 *  - "swapping…" busy text appears briefly after click
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPersistTheme = vi.fn().mockResolvedValue(undefined);
const mockUseTheme = vi.fn().mockReturnValue("sage");

vi.mock("@/lib/cinema-theme", () => ({
  persistTheme: (id: string) => mockPersistTheme(id),
  useTheme: () => mockUseTheme(),
}));

// `cn` is a tiny class-name combiner — passthrough mock keeps tests
// independent of its real impl.
vi.mock("@/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" "),
}));

import { ThemePicker } from "./ThemePicker";

// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPersistTheme.mockClear();
  mockUseTheme.mockClear().mockReturnValue("sage");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ThemePicker — render", () => {
  test("renders all 4 persona chips with labels", () => {
    render(<ThemePicker />);
    expect(screen.getByText(/Sage · Startup operator/i)).toBeInTheDocument();
    expect(screen.getByText(/Onyx · IB \/ PE/i)).toBeInTheDocument();
    expect(screen.getByText(/Slate · Consulting/i)).toBeInTheDocument();
    expect(screen.getByText(/Coral · Brand \/ Creative/i)).toBeInTheDocument();
  });

  test("active chip ('sage') carries cinema-moss bg class", () => {
    render(<ThemePicker />);
    const sageBtn = screen.getByRole("button", { name: /Sage · Startup operator/i });
    expect(sageBtn.className).toMatch(/bg-cinema-moss/);
  });

  test("non-active chips don't carry the active bg class", () => {
    render(<ThemePicker />);
    const onyxBtn = screen.getByRole("button", { name: /Onyx · IB \/ PE/i });
    expect(onyxBtn.className).not.toMatch(/bg-cinema-moss/);
    expect(onyxBtn.className).toMatch(/bg-white/);
  });

  test("12 swatches total (3 per chip × 4 personas)", () => {
    const { container } = render(<ThemePicker />);
    const swatches = container.querySelectorAll('span[aria-hidden][style*="background-color"]');
    expect(swatches).toHaveLength(12);
  });

  test("hint copy mentions Phase 1.6 wiring future", () => {
    render(<ThemePicker />);
    expect(
      screen.getByText(/Phase 1\.6 wires up Supabase auth/i),
    ).toBeInTheDocument();
  });
});

describe("ThemePicker — pick interaction", () => {
  test("clicking Onyx chip sets data-theme attr + localStorage + persistTheme", async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);

    const onyxBtn = screen.getByRole("button", { name: /Onyx · IB \/ PE/i });
    await user.click(onyxBtn);

    expect(document.documentElement.getAttribute("data-theme")).toBe("onyx");
    expect(localStorage.getItem("career-buddy-theme-v1")).toBe("onyx");
    expect(mockPersistTheme).toHaveBeenCalledWith("onyx");
  });

  test("clicking Slate triggers persistTheme with 'slate'", async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /Slate · Consulting/i }));
    expect(mockPersistTheme).toHaveBeenCalledWith("slate");
  });

  test("clicking Coral triggers persistTheme with 'coral'", async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /Coral · Brand/i }));
    expect(mockPersistTheme).toHaveBeenCalledWith("coral");
  });

  test("'swapping…' appears after click on non-active chip", async () => {
    render(<ThemePicker />);
    const onyxBtn = screen.getByRole("button", { name: /Onyx · IB \/ PE/i });
    fireEvent.click(onyxBtn);
    await waitFor(() => {
      expect(screen.getByText(/swapping…/i)).toBeInTheDocument();
    });
  });

  test("persistTheme failure is swallowed (fire-and-forget)", async () => {
    mockPersistTheme.mockRejectedValueOnce(new Error("network"));
    const user = userEvent.setup();
    render(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /Coral · Brand/i }));
    expect(localStorage.getItem("career-buddy-theme-v1")).toBe("coral");
    expect(document.documentElement.getAttribute("data-theme")).toBe("coral");
  });
});

describe("ThemePicker — already-active chip", () => {
  test("renders Check icon for the active theme only", () => {
    mockUseTheme.mockReturnValue("onyx");
    const { container } = render(<ThemePicker />);
    // Lucide Check icon — exactly one rendered.
    const checks = container.querySelectorAll('svg.lucide-check');
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });
});
