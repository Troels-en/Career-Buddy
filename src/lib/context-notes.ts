/**
 * Phase 5 — auto-context notes.
 *
 * Buddy quietly persists structured takeaways from chat conversations,
 * profile edits, and CV analysis back to the Supabase
 * `user_context_notes` table (migration 0013) so future sessions and
 * future devices carry the same context without re-asking the user.
 *
 * Best-effort: every write swallows network errors and returns
 * `false` so the UI never blocks on a flaky network. localStorage
 * is NOT the canonical store here — notes are append-only Supabase
 * rows. Offline writes are dropped (acceptable for v1 — Buddy will
 * re-derive context from the next conversation).
 *
 * Single-user phase: writes set `user_id: null`. When multi-tenant
 * auth lands, swap to `auth.uid()` + add RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";

export type ContextNoteSource = "buddy" | "profile" | "cv" | "manual";

const VALID_SOURCES: ReadonlySet<ContextNoteSource> = new Set([
  "buddy",
  "profile",
  "cv",
  "manual",
]);

export type ContextNote = {
  id: string;
  note_text: string;
  source: ContextNoteSource;
  metadata: Record<string, unknown>;
  created_at: string;
};

type InsertRow = {
  user_id: string | null;
  note_text: string;
  source: ContextNoteSource;
  metadata: Record<string, unknown>;
};

function sanitizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

/**
 * Persist one note. Returns true on success, false on any failure
 * (network down, table missing, RLS reject). Caller never throws.
 */
export async function saveContextNote(
  noteText: string,
  source: ContextNoteSource = "buddy",
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const trimmed = noteText.trim();
  if (!trimmed) return false;
  const safeSource = VALID_SOURCES.has(source) ? source : "buddy";
  const row: InsertRow = {
    user_id: null,
    note_text: trimmed,
    source: safeSource,
    metadata: sanitizeMetadata(metadata),
  };
  try {
    const { error } = await supabase
      .from("user_context_notes" as never)
      .insert(row as never);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch the user's most-recent notes, newest-first. Defaults to 20
 * rows. Returns `[]` on any failure so the UI can render an empty
 * state without special-casing.
 */
export async function fetchRecentContextNotes(
  limit = 20,
): Promise<ContextNote[]> {
  try {
    const { data, error } = await supabase
      .from("user_context_notes" as never)
      .select("id,note_text,source,metadata,created_at")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(500, limit)));
    if (error || !data) return [];
    return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ""),
      note_text: String(r.note_text ?? ""),
      source: VALID_SOURCES.has(r.source as ContextNoteSource)
        ? (r.source as ContextNoteSource)
        : "buddy",
      metadata: sanitizeMetadata(r.metadata),
      created_at: String(r.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}
