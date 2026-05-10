/**
 * RTL tests for EmailAccounts. UI session owns the component (Phase
 * 1.5 stub); tests written by backend session per CLAUDE_COORDINATION.md
 * round-7. Component currently has no async deps — pure UI mock until
 * Phase 1.6 OAuth lands.
 *
 * Coverage:
 *  - Empty state visible by default
 *  - 3 connect buttons (Gmail / Outlook / IMAP) rendered
 *  - Click on Connect Gmail → info modal appears
 *  - Modal has provider name + Phase 1.6 explainer
 *  - "Got it" closes the modal
 *  - Click on backdrop closes the modal
 *  - Stop-propagation: click inside modal does NOT close it
 *  - Phase 1.5 stub footer text visible
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" "),
}));

import { EmailAccounts } from "./EmailAccounts";

// ---------------------------------------------------------------------------

describe("EmailAccounts — empty state", () => {
  test("shows 'No accounts connected.' headline", () => {
    render(<EmailAccounts />);
    expect(screen.getByText(/No accounts connected\./i)).toBeInTheDocument();
  });

  test("explains why connecting helps (read replies / draft outreach)", () => {
    render(<EmailAccounts />);
    expect(
      screen.getByText(/read application\s+replies/i),
    ).toBeInTheDocument();
  });

  test("Phase 1.5 stub footer text visible", () => {
    render(<EmailAccounts />);
    expect(
      screen.getByText(/Phase 1\.5 UI stub/i),
    ).toBeInTheDocument();
  });
});

describe("EmailAccounts — connect buttons", () => {
  test("renders all 3 connect buttons", () => {
    render(<EmailAccounts />);
    expect(screen.getByRole("button", { name: /Connect Gmail/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Outlook/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect IMAP/i })).toBeInTheDocument();
  });

  test("Connect Gmail click opens info modal", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Gmail/i }));
    expect(screen.getByRole("heading", { name: /Connect Gmail/i })).toBeInTheDocument();
    expect(screen.getByText(/Phase 1\.6 — coming soon/i)).toBeInTheDocument();
  });

  test("Connect Outlook click opens modal labelled Outlook", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Outlook/i }));
    expect(screen.getByRole("heading", { name: /Connect Outlook/i })).toBeInTheDocument();
  });

  test("Connect IMAP click opens modal labelled IMAP", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect IMAP/i }));
    expect(screen.getByRole("heading", { name: /Connect IMAP/i })).toBeInTheDocument();
  });

  test("modal mentions encrypted token storage + migration 0010", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Gmail/i }));
    expect(
      screen.getByText(/encrypted token storage/i),
    ).toBeInTheDocument();
    // 'migration 0010' appears in both the page footer and the modal —
    // assert at least one match exists.
    expect(screen.getAllByText(/migration 0010/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("EmailAccounts — modal close", () => {
  test("'Got it' button closes modal", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Gmail/i }));
    expect(screen.getByRole("heading", { name: /Connect Gmail/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Got it/i }));
    expect(screen.queryByRole("heading", { name: /Connect Gmail/i })).not.toBeInTheDocument();
  });

  test("clicking backdrop closes modal", async () => {
    const user = userEvent.setup();
    const { container } = render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Gmail/i }));
    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    if (backdrop) fireEvent.click(backdrop);
    expect(screen.queryByRole("heading", { name: /Connect Gmail/i })).not.toBeInTheDocument();
  });

  test("click inside modal panel does NOT close (stopPropagation)", async () => {
    const user = userEvent.setup();
    render(<EmailAccounts />);
    await user.click(screen.getByRole("button", { name: /Connect Gmail/i }));
    const heading = screen.getByRole("heading", { name: /Connect Gmail/i });
    fireEvent.click(heading);
    expect(screen.getByRole("heading", { name: /Connect Gmail/i })).toBeInTheDocument();
  });
});
