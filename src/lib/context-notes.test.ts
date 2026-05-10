import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocked Supabase — replicates the chainable shape:
//   supabase.from(table).insert(row)
//   supabase.from(table).select(cols).is(col,val).order(col,opts).limit(n)
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockLimit = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => mockInsert(row),
      select: () => ({
        is: () => ({
          order: () => ({
            limit: (n: number) => mockLimit(n),
          }),
        }),
      }),
    }),
  },
}));

import {
  fetchRecentContextNotes,
  saveContextNote,
  type ContextNote,
} from "./context-notes";

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ data: null, error: null });
  mockLimit.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// saveContextNote
// ---------------------------------------------------------------------------

describe("saveContextNote", () => {
  test("inserts a trimmed note with default source=buddy and empty metadata", async () => {
    const ok = await saveContextNote("  user wants Berlin remote roles  ");
    expect(ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: null,
      note_text: "user wants Berlin remote roles",
      source: "buddy",
      metadata: {},
    });
  });

  test("accepts the four valid sources verbatim", async () => {
    for (const src of ["buddy", "profile", "cv", "manual"] as const) {
      mockInsert.mockClear();
      await saveContextNote("x", src);
      expect(mockInsert.mock.calls[0][0].source).toBe(src);
    }
  });

  test("coerces unknown source values to 'buddy'", async () => {
    await saveContextNote("x", "weird-source" as never);
    expect(mockInsert.mock.calls[0][0].source).toBe("buddy");
  });

  test("forwards metadata payload untouched when it's a plain object", async () => {
    await saveContextNote("note", "cv", { conversation_id: "abc", job_id: 42 });
    expect(mockInsert.mock.calls[0][0].metadata).toEqual({
      conversation_id: "abc",
      job_id: 42,
    });
  });

  test("normalises non-object metadata to {}", async () => {
    await saveContextNote("note", "buddy", "not-an-object" as never);
    expect(mockInsert.mock.calls[0][0].metadata).toEqual({});
    mockInsert.mockClear();
    await saveContextNote("note", "buddy", [1, 2, 3] as never);
    expect(mockInsert.mock.calls[0][0].metadata).toEqual({});
  });

  test("empty/whitespace note_text returns false, no insert", async () => {
    expect(await saveContextNote("")).toBe(false);
    expect(await saveContextNote("   ")).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test("returns false when Supabase returns an error", async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: { message: "rls" } });
    expect(await saveContextNote("note")).toBe(false);
  });

  test("returns false when Supabase throws (offline, etc.)", async () => {
    mockInsert.mockRejectedValueOnce(new Error("network"));
    expect(await saveContextNote("note")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchRecentContextNotes
// ---------------------------------------------------------------------------

describe("fetchRecentContextNotes", () => {
  test("returns parsed rows on success", async () => {
    const row = {
      id: "abc-123",
      note_text: "Wants Berlin",
      source: "buddy",
      metadata: { conversation_id: "c1" },
      created_at: "2026-05-10T20:00:00Z",
    };
    mockLimit.mockResolvedValueOnce({ data: [row], error: null });
    const notes = await fetchRecentContextNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual<ContextNote>({
      id: "abc-123",
      note_text: "Wants Berlin",
      source: "buddy",
      metadata: { conversation_id: "c1" },
      created_at: "2026-05-10T20:00:00Z",
    });
  });

  test("passes through the limit (default 20)", async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    await fetchRecentContextNotes();
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  test("clamps limit to [1, 500]", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });
    await fetchRecentContextNotes(0);
    expect(mockLimit).toHaveBeenLastCalledWith(1);
    await fetchRecentContextNotes(99999);
    expect(mockLimit).toHaveBeenLastCalledWith(500);
  });

  test("returns [] when Supabase errors", async () => {
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: { message: "table missing" },
    });
    expect(await fetchRecentContextNotes()).toEqual([]);
  });

  test("returns [] when Supabase throws", async () => {
    mockLimit.mockRejectedValueOnce(new Error("network"));
    expect(await fetchRecentContextNotes()).toEqual([]);
  });

  test("returns [] when payload is null", async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchRecentContextNotes()).toEqual([]);
  });

  test("coerces unknown source values to 'buddy' on read", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: "1",
          note_text: "x",
          source: "bogus",
          metadata: {},
          created_at: "2026-05-10T00:00:00Z",
        },
      ],
      error: null,
    });
    const notes = await fetchRecentContextNotes();
    expect(notes[0].source).toBe("buddy");
  });

  test("coerces non-object metadata to {} on read", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: "1",
          note_text: "x",
          source: "cv",
          metadata: "not-object",
          created_at: "2026-05-10T00:00:00Z",
        },
      ],
      error: null,
    });
    const notes = await fetchRecentContextNotes();
    expect(notes[0].metadata).toEqual({});
  });
});
