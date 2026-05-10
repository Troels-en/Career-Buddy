/**
 * RTL tests for the Profile route's Section 03 — Skills board.
 *
 * UI session owns `src/routes/profile.tsx`; this session writes the
 * tests per CLAUDE_COORDINATION.md round-10. Coverage targets the
 * round-9 wire that replaced the "Coming with Phase 1" placeholder
 * with a live skills list driven by
 * `useCareerBuddyState().profile.skills`.
 *
 * Mocks (whole route is heavy — strip everything outside Section 03):
 *  - `@tanstack/react-router`.createFileRoute — passthrough that
 *    exposes `Route.options.component` so we can render the page
 *    function directly without router context.
 *  - `@/components/cinema/*` — stub each primitive to a plain div so
 *    we don't load the design system + photography.
 *  - `@/components/profile/CvUploadInline` — stub that exposes the
 *    `onAnalysed` prop as a button click; lets us drive
 *    `refreshAfterCv` from the test.
 *  - `@/components/profile/EmailAccounts` + `ThemePicker` — empty stubs.
 *  - `@/lib/cinema-theme.usePhoto` — returns a stable URL.
 *  - `@/lib/cv-storage.loadCareerBuddyState` — controllable skills payload.
 *  - `@/lib/profile-store` — all helpers stubbed; init resolves async
 *    so we can assert the post-init re-read.
 *  - `@/lib/tracks` — empty TRACKS array (Section 02 renders nothing).
 *
 * Coverage:
 *  - Empty state: "Skills board" eyebrow + Upload-CV anchor button
 *  - Populated: each skill rendered as a chip with name
 *  - Skill with level → uppercase level pill inside chip
 *  - Skill with positive years → "· {n}y" suffix
 *  - Skill with years=0 → suffix omitted
 *  - Skill with no level + no years → only the name renders
 *  - Skills count badge in eyebrow ("Extracted from your CV · N")
 *  - initProfileFromSupabase fires on mount → re-read picks up
 *    remote skills if local was empty
 *  - onAnalysed → refreshAfterCv → Section 03 re-reads skills
 */

import type * as React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SkillEntry } from "@/lib/cv-storage";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// createFileRoute passthrough — keep options.component callable.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (opts: Record<string, unknown>) => ({
    options: opts,
  }),
}));

// Cinema design-system primitives — stub each to a plain div / anchor.
vi.mock("@/components/cinema", () => ({
  CinematicHero: ({ headline, subhead, cta, eyebrow }: Record<string, React.ReactNode>) => (
    <div data-testid="hero">
      <div data-testid="hero-eyebrow">{eyebrow}</div>
      <div data-testid="hero-headline">{headline}</div>
      <div data-testid="hero-subhead">{subhead}</div>
      <div data-testid="hero-cta">{cta}</div>
    </div>
  ),
  GlassCard: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card">{children}</div>,
  GlassPanel: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-panel">{children}</div>,
  PillLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  RevealOnScroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionDivider: () => <div data-testid="section-divider" />,
}));

// Other profile components — keep them inert except CvUploadInline
// which needs to expose the `onAnalysed` prop.
const mockCvUploadOnAnalysed = vi.fn();
vi.mock("@/components/profile/CvUploadInline", () => ({
  CvUploadInline: (props: { onAnalysed?: () => void }) => {
    mockCvUploadOnAnalysed.mockImplementation(() => props.onAnalysed?.());
    return (
      <button
        type="button"
        data-testid="cv-upload-fire-analysed"
        onClick={() => props.onAnalysed?.()}
      >
        fire onAnalysed
      </button>
    );
  },
}));
vi.mock("@/components/profile/EmailAccounts", () => ({
  EmailAccounts: () => <div data-testid="email-accounts" />,
}));
vi.mock("@/components/profile/ThemePicker", () => ({
  ThemePicker: () => <div data-testid="theme-picker" />,
}));

vi.mock("@/lib/cinema-theme", () => ({
  usePhoto: () => "https://example.test/photo.jpg",
}));

// Skills state — flip per test via mockSkills.
let mockSkills: SkillEntry[] = [];
vi.mock("@/lib/cv-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cv-storage")>("@/lib/cv-storage");
  return {
    ...actual,
    loadCareerBuddyState: () => ({ profile: { skills: mockSkills } }),
  };
});

const mockInit = vi.fn();
const mockLoadTracks = vi.fn();
const mockLoadYears = vi.fn();
const mockSetTracks = vi.fn();
const mockSetYears = vi.fn();
vi.mock("@/lib/profile-store", () => ({
  initProfileFromSupabase: () => mockInit(),
  loadSelectedTracks: () => mockLoadTracks(),
  loadYearsBucket: () => mockLoadYears(),
  setSelectedTracks: (tracks: string[]) => mockSetTracks(tracks),
  setYearsBucket: (bucket: string) => mockSetYears(bucket),
}));

vi.mock("@/lib/tracks", () => ({
  TRACKS: [],
}));

// Import the route AFTER mocks so the module picks up the stubs.
import { Route } from "./profile";

// ---------------------------------------------------------------------------

type ProfilePageComponent = () => React.ReactElement;

function renderProfilePage() {
  const opts = (Route as unknown as { options: { component: ProfilePageComponent } }).options;
  const ProfilePage = opts.component;
  return render(<ProfilePage />);
}

beforeEach(() => {
  mockSkills = [];
  mockInit.mockReset().mockResolvedValue(undefined);
  mockLoadTracks.mockReset().mockReturnValue([]);
  mockLoadYears.mockReset().mockReturnValue(null);
  mockSetTracks.mockReset();
  mockSetYears.mockReset();
  mockCvUploadOnAnalysed.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Section 03 — empty state
// ---------------------------------------------------------------------------

describe("Profile Section 03 — empty state", () => {
  test("shows 'Skills board' eyebrow when no skills present", async () => {
    mockSkills = [];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText(/Skills board/i)).toBeInTheDocument();
    });
  });

  test("shows 'No skills yet.' explainer + Upload CV CTA jumping to #cv-upload", async () => {
    mockSkills = [];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText(/No skills yet/i)).toBeInTheDocument();
    });
    const cta = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "#cv-upload" && /Upload CV/i.test(a.textContent ?? ""));
    expect(cta).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Section 03 — populated state
// ---------------------------------------------------------------------------

describe("Profile Section 03 — populated state", () => {
  test("renders one chip per skill with the name", async () => {
    mockSkills = [
      { name: "Python" },
      { name: "SQL" },
      { name: "Figma" },
    ];
    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByText("Figma")).toBeInTheDocument();
  });

  test("skill with level renders level pill (uppercase)", async () => {
    mockSkills = [{ name: "Python", level: "advanced" }];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });
    // Level rendered as plain text inside the chip; the uppercase
    // styling lives in CSS classes — we assert the string is present.
    expect(screen.getByText("advanced")).toBeInTheDocument();
  });

  test("skill with positive years renders '· {n}y' suffix", async () => {
    mockSkills = [{ name: "SQL", years: 4 }];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("SQL")).toBeInTheDocument();
    });
    expect(screen.getByText(/·\s*4y/)).toBeInTheDocument();
  });

  test("skill with years=0 omits the years suffix", async () => {
    mockSkills = [{ name: "TypeScript", years: 0 }];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
    });
    expect(screen.queryByText(/·\s*0y/)).not.toBeInTheDocument();
  });

  test("skill with neither level nor years renders only the name", async () => {
    mockSkills = [{ name: "BareSkill" }];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("BareSkill")).toBeInTheDocument();
    });
    // No level enum text + no years suffix expected.
    expect(screen.queryByText(/·\s*\d+y/)).not.toBeInTheDocument();
    for (const lvl of ["beginner", "intermediate", "advanced", "expert"]) {
      expect(screen.queryByText(lvl)).not.toBeInTheDocument();
    }
  });

  test("eyebrow shows count when skills present ('Extracted from your CV · N')", async () => {
    mockSkills = [
      { name: "Python" },
      { name: "SQL" },
      { name: "Figma" },
      { name: "Notion" },
    ];
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText(/Extracted from your CV · 4/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Init + refresh flow
// ---------------------------------------------------------------------------

describe("Profile Section 03 — init + refresh", () => {
  test("initProfileFromSupabase is called on mount", async () => {
    renderProfilePage();
    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });
  });

  test("post-init re-read surfaces skills written by Supabase merge", async () => {
    // Empty at first paint; Supabase init resolves and the SECOND
    // read (inside the .then()) picks up freshly-merged skills.
    mockSkills = [];
    let resolveInit: () => void = () => {};
    mockInit.mockReset().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveInit = () => {
            mockSkills = [{ name: "Rust", level: "intermediate" }];
            res();
          };
        }),
    );

    renderProfilePage();
    expect(screen.getByText(/No skills yet/i)).toBeInTheDocument();

    resolveInit();
    await waitFor(() => {
      expect(screen.getByText("Rust")).toBeInTheDocument();
    });
    expect(screen.queryByText(/No skills yet/i)).not.toBeInTheDocument();
  });

  test("onAnalysed callback triggers Section 03 refresh", async () => {
    mockSkills = [];
    renderProfilePage();
    expect(screen.getByText(/No skills yet/i)).toBeInTheDocument();

    // Simulate CvUploadInline finishing a successful analysis:
    // localStorage now has freshly-merged skills, button fires the
    // onAnalysed prop which calls refreshAfterCv on the parent.
    mockSkills = [{ name: "Bash" }];
    const fireBtn = screen.getByTestId("cv-upload-fire-analysed");
    await userEvent.setup().click(fireBtn);

    await waitFor(() => {
      expect(screen.getByText("Bash")).toBeInTheDocument();
    });
  });
});
