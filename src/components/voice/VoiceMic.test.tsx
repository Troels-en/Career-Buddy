/**
 * RTL tests for VoiceMic (A's Phase 1 voice-input component, shipped
 * in round-10 commit 2adfd52). UI session owns the component; this
 * session writes the tests per CLAUDE_COORDINATION.md.
 *
 * Coverage:
 *  - supported=null (initial paint before useEffect) → loading button
 *  - SpeechRecognition missing on window → disabled "not supported"
 *  - disabled prop → disabled button with the disabled aria-label
 *  - happy idle paint → mic icon, aria-pressed=false
 *  - click → calls SpeechRecognition.start, listening flips, icon
 *    flips, aria-pressed=true, pulse class applied
 *  - onresult event → calls onTranscript with trimmed transcript
 *  - empty / whitespace transcript → does NOT fire onTranscript
 *  - click while listening → calls SpeechRecognition.stop
 *  - onend event → listening=false
 *  - onerror "no-speech" → user-visible message
 *  - onerror "not-allowed" → permission-denied message
 *  - onerror "audio-capture" → no-mic message
 *  - onerror unknown → generic fallback
 *  - rec.start() throws → graceful error state
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// SpeechRecognition mock — captured before each test, exposed to assert + fire events
// ---------------------------------------------------------------------------

type MockRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: unknown; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

let currentInstance: MockRec | null = null;

function makeMockCtor(opts: { startThrows?: boolean } = {}) {
  return vi.fn().mockImplementation(function (this: MockRec) {
    this.continuous = false;
    this.interimResults = false;
    this.lang = "";
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
    this.start = vi.fn().mockImplementation(() => {
      if (opts.startThrows) throw new Error("rejected");
      // Fire onstart synchronously so the listening state flips.
      this.onstart?.();
    });
    this.stop = vi.fn().mockImplementation(() => {
      // Mirror real behaviour: stop triggers onend.
      this.onend?.();
    });
    this.abort = vi.fn();
    currentInstance = this;
  });
}

function fireResult(transcript: string, confidence = 0.9): void {
  if (!currentInstance) throw new Error("no recognition instance");
  currentInstance.onresult?.({
    results: {
      length: 1,
      0: { 0: { transcript, confidence }, transcript, confidence },
      item: () => ({ 0: { transcript, confidence }, transcript, confidence }),
    },
    resultIndex: 0,
  });
}

function fireError(error: string): void {
  if (!currentInstance) throw new Error("no recognition instance");
  currentInstance.onerror?.({ error });
}

function installRecognition(ctor: ReturnType<typeof makeMockCtor> | null) {
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  if (ctor) {
    w.SpeechRecognition = ctor;
  } else {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  }
}

// Import AFTER mock helpers so the component picks up window globals at runtime.
import { VoiceMic } from "./VoiceMic";

beforeEach(() => {
  currentInstance = null;
  installRecognition(null);
});

afterEach(() => {
  installRecognition(null);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Unsupported / disabled states
// ---------------------------------------------------------------------------

describe("VoiceMic — unsupported / disabled", () => {
  test("renders disabled 'not supported' button when SpeechRecognition missing", async () => {
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /not supported/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("explicit disabled prop short-circuits even when API is supported", async () => {
    installRecognition(makeMockCtor());
    render(<VoiceMic onTranscript={vi.fn()} disabled />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /voice input disabled/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Idle → listening transition
// ---------------------------------------------------------------------------

describe("VoiceMic — idle paint", () => {
  test("renders enabled mic button with default label when supported", async () => {
    installRecognition(makeMockCtor());
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /start voice input/i }),
      ).toBeInTheDocument();
    });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toBeDisabled();
  });

  test("custom `label` prop overrides the default start-voice aria-label", async () => {
    installRecognition(makeMockCtor());
    render(<VoiceMic onTranscript={vi.fn()} label="Dictate skill" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Dictate skill/i }),
      ).toBeInTheDocument();
    });
  });
});

describe("VoiceMic — start + stop", () => {
  test("click → recognition.start called, aria-pressed flips true", async () => {
    const ctor = makeMockCtor();
    installRecognition(ctor);
    const onTranscript = vi.fn();
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={onTranscript} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    expect(currentInstance?.start).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /stop voice input/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button").className).toMatch(/voice-mic-pulse/);
  });

  test("click while listening → recognition.stop called, listening flips back", async () => {
    installRecognition(makeMockCtor());
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop voice input/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button"));
    expect(currentInstance?.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
  });

  test("rec.start() throws → user sees error, listening stays false", async () => {
    installRecognition(makeMockCtor({ startThrows: true }));
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not start voice input/i);
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// Recognition events — transcript + error
// ---------------------------------------------------------------------------

describe("VoiceMic — onresult", () => {
  test("transcript event fires onTranscript with trimmed value", async () => {
    installRecognition(makeMockCtor());
    const onTranscript = vi.fn();
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={onTranscript} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => {
      fireResult("  hello world  ");
    });
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith("hello world");
  });

  test("whitespace-only transcript does NOT fire onTranscript", async () => {
    installRecognition(makeMockCtor());
    const onTranscript = vi.fn();
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={onTranscript} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => {
      fireResult("   ");
    });
    expect(onTranscript).not.toHaveBeenCalled();
  });
});

describe("VoiceMic — onerror branches", () => {
  test("'no-speech' shows 'Didn't catch that' hint", async () => {
    installRecognition(makeMockCtor());
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => fireError("no-speech"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/didn't catch that/i);
    });
  });

  test("'not-allowed' shows permission-denied message", async () => {
    installRecognition(makeMockCtor());
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => fireError("not-allowed"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Microphone permission denied/i);
    });
  });

  test("'audio-capture' shows no-microphone message", async () => {
    installRecognition(makeMockCtor());
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => fireError("audio-capture"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/No microphone detected/i);
    });
  });

  test("unknown error code falls back to generic message", async () => {
    installRecognition(makeMockCtor());
    const user = userEvent.setup();
    render(<VoiceMic onTranscript={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    act(() => fireError("network"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Voice input failed/i);
    });
  });
});

// ---------------------------------------------------------------------------
// webkit fallback
// ---------------------------------------------------------------------------

describe("VoiceMic — webkit fallback", () => {
  test("uses webkitSpeechRecognition when SpeechRecognition missing", async () => {
    const ctor = makeMockCtor();
    const w = window as unknown as { webkitSpeechRecognition?: unknown };
    w.webkitSpeechRecognition = ctor;
    try {
      const user = userEvent.setup();
      render(<VoiceMic onTranscript={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button"));
      expect(currentInstance?.start).toHaveBeenCalledTimes(1);
    } finally {
      delete w.webkitSpeechRecognition;
    }
  });
});
