/**
 * RTL tests for LinkedInImport — the LinkedIn fast-start onboarding
 * path. Reuses the `analyze-cv` edge function + `setProfileFromAnalysis`
 * persistence, same as CvUploadInline, so the mocks mirror that test.
 *
 * Mocks:
 *  - `@/integrations/supabase/client`.supabase   — `.functions.invoke`
 *  - `@/lib/profile-store`.setProfileFromAnalysis — assert persist wiring
 *
 * Paths covered:
 *  - paste profile text → analyse → persist (filename "LinkedIn profile") → done
 *  - onAnalysed callback fires after success
 *  - too-short paste → error, no edge-function call
 *  - supabase.functions.invoke returns error → user-visible error, no persist
 *  - payload missing analysis → error message
 *  - Build-profile button disabled when textarea empty
 *  - setProfileFromAnalysis rejects → user sees error, onAnalysed NOT fired
 *  - non-LinkedIn URL → inline validation hint
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (fn: string, opts: unknown) => mockInvoke(fn, opts),
    },
  },
}));

const mockSetProfileFromAnalysis = vi.fn();
vi.mock("@/lib/profile-store", () => ({
  setProfileFromAnalysis: (analysis: unknown, filename: string) =>
    mockSetProfileFromAnalysis(analysis, filename),
}));

// Import AFTER mocks so the module picks up the stubs.
import { LinkedInImport } from "./LinkedInImport";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const longProfile =
  "Strategy graduate with two years in B2B SaaS. Worked on deal sourcing, " +
  "built sales enablement material, comfortable with SQL and market research.";

beforeEach(() => {
  mockInvoke.mockReset();
  mockSetProfileFromAnalysis.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LinkedInImport — happy path", () => {
  test("paste profile text → analyse → persist → done summary", async () => {
    mockInvoke.mockResolvedValue({
      data: { analysis: { summary: "Strong operator profile." } },
      error: null,
    });

    const onAnalysed = vi.fn();
    const user = userEvent.setup();
    render(<LinkedInImport onAnalysed={onAnalysed} />);

    const textarea = screen.getByPlaceholderText(/Paste your LinkedIn profile text/i);
    await user.type(textarea, longProfile);

    const buildBtn = screen.getByRole("button", { name: /Build profile from LinkedIn/i });
    await user.click(buildBtn);

    await waitFor(() => {
      expect(screen.getByText(/Strong operator profile\./)).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "analyze-cv",
      expect.objectContaining({ body: expect.objectContaining({ cvText: longProfile }) }),
    );
    expect(mockSetProfileFromAnalysis).toHaveBeenCalledTimes(1);
    expect(mockSetProfileFromAnalysis.mock.calls[0][1]).toBe("LinkedIn profile");
    expect(onAnalysed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Open Overview to review/)).toBeInTheDocument();
  });
});

describe("LinkedInImport — error paths", () => {
  test("too-short paste → error, no edge-function call", async () => {
    const user = userEvent.setup();
    render(<LinkedInImport />);

    const textarea = screen.getByPlaceholderText(/Paste your LinkedIn profile text/i);
    await user.type(textarea, "too short");

    const buildBtn = screen.getByRole("button", { name: /Build profile from LinkedIn/i });
    await user.click(buildBtn);

    await waitFor(() => {
      expect(screen.getByText(/Paste a bit more of your LinkedIn profile/i)).toBeInTheDocument();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockSetProfileFromAnalysis).not.toHaveBeenCalled();
  });

  test("supabase.functions.invoke returns error → user sees error, no persist", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("rate-limited") });

    const user = userEvent.setup();
    render(<LinkedInImport />);

    await user.type(screen.getByPlaceholderText(/Paste your LinkedIn profile text/i), longProfile);
    await user.click(screen.getByRole("button", { name: /Build profile from LinkedIn/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate-limited/i)).toBeInTheDocument();
    });

    expect(mockSetProfileFromAnalysis).not.toHaveBeenCalled();
  });

  test("payload missing analysis → error fallback", async () => {
    mockInvoke.mockResolvedValue({
      data: { error: "Gemini quota exhausted" },
      error: null,
    });

    const user = userEvent.setup();
    render(<LinkedInImport />);

    await user.type(screen.getByPlaceholderText(/Paste your LinkedIn profile text/i), longProfile);
    await user.click(screen.getByRole("button", { name: /Build profile from LinkedIn/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gemini quota exhausted/i)).toBeInTheDocument();
    });

    expect(mockSetProfileFromAnalysis).not.toHaveBeenCalled();
  });

  test("Build-profile button disabled when textarea empty", () => {
    render(<LinkedInImport />);
    expect(screen.getByRole("button", { name: /Build profile from LinkedIn/i })).toBeDisabled();
  });

  test("setProfileFromAnalysis rejects → user sees error, onAnalysed NOT fired", async () => {
    mockInvoke.mockResolvedValue({
      data: { analysis: { summary: "ok" } },
      error: null,
    });
    mockSetProfileFromAnalysis.mockRejectedValueOnce(new Error("persist blew up"));

    const onAnalysed = vi.fn();
    const user = userEvent.setup();
    render(<LinkedInImport onAnalysed={onAnalysed} />);

    await user.type(screen.getByPlaceholderText(/Paste your LinkedIn profile text/i), longProfile);
    await user.click(screen.getByRole("button", { name: /Build profile from LinkedIn/i }));

    await waitFor(() => {
      expect(screen.getByText(/persist blew up/i)).toBeInTheDocument();
    });

    expect(onAnalysed).not.toHaveBeenCalled();
  });
});

describe("LinkedInImport — URL field", () => {
  test("non-LinkedIn URL shows an inline validation hint", async () => {
    const user = userEvent.setup();
    render(<LinkedInImport />);

    const urlInput = screen.getByPlaceholderText(/linkedin\.com\/in\/your-handle/i);
    await user.type(urlInput, "https://example.com/me");

    expect(screen.getByText(/doesn't look like a LinkedIn profile URL/i)).toBeInTheDocument();
  });

  test("valid LinkedIn URL shows no validation hint", async () => {
    const user = userEvent.setup();
    render(<LinkedInImport />);

    const urlInput = screen.getByPlaceholderText(/linkedin\.com\/in\/your-handle/i);
    await user.type(urlInput, "https://www.linkedin.com/in/sample-handle");

    expect(screen.queryByText(/doesn't look like a LinkedIn profile URL/i)).not.toBeInTheDocument();
  });
});
