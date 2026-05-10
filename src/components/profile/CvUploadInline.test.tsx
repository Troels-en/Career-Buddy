/**
 * RTL tests for CvUploadInline (UI session owns the component, this
 * session writes the tests per CLAUDE_COORDINATION.md round-5).
 *
 * Mocks:
 *  - `@/lib/cv-parser`.extractCvText       — fake PDF/DOCX→string
 *  - `@/integrations/supabase/client`.supabase.functions.invoke
 *  - `@/lib/cv-storage`.{loadCareerBuddyState, saveCareerBuddyState,
 *      mergeAnalysisIntoState}             — assert merge wiring
 *
 * Paths covered:
 *  - happy-path file → extract → analyse → merge → done
 *  - paste-then-analyse via "Analyse pasted text" button
 *  - short-text error from extractCvText (<50 chars)
 *  - supabase.functions.invoke returns error → user-visible error
 *  - payload missing analysis → error message
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExtract = vi.fn();
vi.mock("@/lib/cv-parser", () => ({
  extractCvText: (file: File) => mockExtract(file),
}));

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (fn: string, opts: unknown) => mockInvoke(fn, opts),
    },
  },
}));

const mockLoadState = vi.fn();
const mockSaveState = vi.fn();
const mockMerge = vi.fn();
vi.mock("@/lib/cv-storage", () => ({
  loadCareerBuddyState: () => mockLoadState(),
  saveCareerBuddyState: (s: unknown) => mockSaveState(s),
  mergeAnalysisIntoState: (state: unknown, analysis: unknown, filename: string) =>
    mockMerge(state, analysis, filename),
}));

// Import AFTER mocks so the module picks up the stubs.
import { CvUploadInline } from "./CvUploadInline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const longCv = "a".repeat(200);

function makeFile(name = "cv.pdf", body = longCv): File {
  return new File([body], name, { type: "application/pdf" });
}

beforeEach(() => {
  mockExtract.mockReset();
  mockInvoke.mockReset();
  mockLoadState.mockReset().mockReturnValue({});
  mockSaveState.mockReset();
  mockMerge.mockReset().mockImplementation((state, analysis, filename) => ({
    ...state,
    profile: { ...analysis, cv_filename: filename },
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CvUploadInline — happy path", () => {
  test("file upload → extract → analyse → merge → done summary", async () => {
    mockExtract.mockResolvedValue(longCv);
    mockInvoke.mockResolvedValue({
      data: {
        analysis: {
          summary: "Strong B2B sales background.",
          name: "Troels",
          strengths: ["B2B sales"],
        },
      },
      error: null,
    });

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput, makeFile());

    await waitFor(() => {
      expect(screen.getByText(/Strong B2B sales background\./)).toBeInTheDocument();
    });

    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      "analyze-cv",
      expect.objectContaining({ body: expect.objectContaining({ cvText: longCv }) }),
    );
    expect(mockMerge).toHaveBeenCalledTimes(1);
    expect(mockSaveState).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Open Overview to review/)).toBeInTheDocument();
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();
  });
});

describe("CvUploadInline — paste path", () => {
  test("paste text + click Analyse → analyse + merge", async () => {
    mockInvoke.mockResolvedValue({
      data: { analysis: { summary: "Pasted-CV insight." } },
      error: null,
    });

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const textarea = screen.getByPlaceholderText(/paste CV text here/i);
    await user.type(textarea, "I am a 5-year operator with B2B sales chops.");

    const analyseBtn = screen.getByRole("button", { name: /Analyse pasted text/i });
    await user.click(analyseBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pasted-CV insight/)).toBeInTheDocument();
    });

    expect(mockExtract).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockSaveState).toHaveBeenCalledTimes(1);
  });
});

describe("CvUploadInline — error paths", () => {
  test("extractCvText returns short text → error message, no Supabase call", async () => {
    mockExtract.mockResolvedValue("too short");

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile("tiny.pdf", "x"));

    await waitFor(() => {
      expect(screen.getByText(/Could not extract enough text/i)).toBeInTheDocument();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  test("supabase.functions.invoke returns error → user sees error", async () => {
    mockExtract.mockResolvedValue(longCv);
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("rate-limited"),
    });

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile());

    await waitFor(() => {
      expect(screen.getByText(/rate-limited/i)).toBeInTheDocument();
    });

    expect(mockMerge).not.toHaveBeenCalled();
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  test("payload missing analysis → error fallback", async () => {
    mockExtract.mockResolvedValue(longCv);
    mockInvoke.mockResolvedValue({
      data: { error: "Gemini quota exhausted" },
      error: null,
    });

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile());

    await waitFor(() => {
      expect(screen.getByText(/Gemini quota exhausted/i)).toBeInTheDocument();
    });

    expect(mockSaveState).not.toHaveBeenCalled();
  });

  test("extractCvText throws → user sees error message", async () => {
    mockExtract.mockRejectedValue(new Error("Unsupported file"));

    const user = userEvent.setup();
    render(<CvUploadInline />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile("weird.bin"));

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file/i)).toBeInTheDocument();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("Analyse-pasted-text button disabled when textarea empty", () => {
    render(<CvUploadInline />);
    const btn = screen.getByRole("button", { name: /Analyse pasted text/i });
    expect(btn).toBeDisabled();
  });
});
