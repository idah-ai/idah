import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
import type {
  INoteAnchor,
  INoteComment,
  INoteRecord,
  INoteScreenPosition,
  INotesDriverV2,
  Unsubscribe,
} from "../../types";
import type { RecordResponse } from "@/data/model/types";
import { refetches } from "@/utils/refetch";

// ---------------------------------------------------------------------------
// Backend mapping helpers
// ---------------------------------------------------------------------------

function flattenAnchorToBackend(anchor: INoteAnchor): {
  annotation_id: string | undefined;
  anchor_type: "entry" | "annotation";
  position: Record<string, unknown>;
} {
  return {
    annotation_id: anchor.annotation_id ?? undefined,
    anchor_type: anchor.anchor_type,
    position: (anchor.position as Record<string, unknown>) ?? {},
  };
}

function liftAnchorFromBackend(
  annotation_id: string | null,
  anchor_type: "entry" | "annotation" | null | undefined,
  position: unknown,
): INoteAnchor {
  return {
    annotation_id: annotation_id ?? null,
    anchor_type: anchor_type ?? "entry",
    position: position ?? {},
  };
}

function noteFeedToV2(rec: NoteFeedRecord): INoteRecord {
  return {
    id: rec.id,
    anchor: liftAnchorFromBackend(rec.annotation_id, rec.anchor_type, rec.position),
    content_md: rec.content_md,
    status: rec.status,
    resolved: rec.status === "resolved",
    created_by_email: rec.created_by_email,
    created_at: rec.created_at?.toString(),
    updated_at: rec.updated_at?.toString(),
    edited_at: rec.edited_at?.toString() ?? null,
  };
}

async function fetchCommentsForFeed(feedId: string): Promise<INoteComment[]> {
  const res = await noteCommentsBackendDataSource.list({
    filters: { note_feed_id: feedId },
    sort: ["created_at"],
    noCache: true,
  });
  return res.data.map(
    (rec: NoteCommentRecord): INoteComment => ({
      id: rec.id,
      note_feed_id: rec.note_feed_id,
      content_md: rec.content_md,
      created_by_email: rec.created_by_email,
      created_at: rec.created_at?.toString() ?? "",
      updated_at: rec.updated_at?.toString() ?? "",
      edited_at: rec.edited_at?.toString() ?? null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Adapter: notes — Observer-based push interface
// ---------------------------------------------------------------------------
export class NotesDriverAdapter implements INotesDriverV2 {
  // ── Internal cache ─────────────────────────────────────────────────────
  private cache: Map<string, INoteRecord> = new Map();
  private commentCache: Map<string, INoteComment[]> = new Map();

  // ── Plugin→Core callback sets ─────────────────────────────────────────
  private notePositionListeners: Set<(pos: INoteScreenPosition) => void> = new Set();
  private noteSelectionListeners: Set<(noteId: string | null) => void> = new Set();
  private createIntentListeners: Set<(anchor: INoteAnchor) => void> = new Set();

  // ── Filter state (synced with sidebar) ──────────────────────────────
  private _includeResolved = false;

  // ── Core→Plugin listener sets (exposed on INotesDriverV2) ────────────
  private notesChangeListeners: Set<(notes: INoteRecord[]) => void> = new Set();
  private focusNoteListeners: Set<(note: INoteRecord | null) => void> = new Set();

  // Buffer for focusNote calls made before any listener is registered.
  private pendingFocusNote: INoteRecord | null | undefined = undefined;
  // Buffer for selectNote calls made before any selection listener is registered.
  private pendingSelectNote: string | null | undefined = undefined;

  private _fetchPromise: Promise<INoteRecord[]> | null = null;

  // ── Entry context ──────────────────────────────────────────────────────
  private readonly entryId: string;

  constructor(entryId: string) {
    this.entryId = entryId;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INotesDriverV2 — Core → Plugin observers
  // ═══════════════════════════════════════════════════════════════════════

  onNotesChange(cb: (notes: INoteRecord[]) => void): Unsubscribe {
    this.notesChangeListeners.add(cb);
    cb(Array.from(this.cache.values()));
    return () => this.notesChangeListeners.delete(cb);
  }

  onFocusNote(cb: (note: INoteRecord | null) => void): Unsubscribe {
    this.focusNoteListeners.add(cb);
    // Flush any buffered focusNote to the newly registered listener
    if (this.pendingFocusNote !== undefined) {
      cb(this.pendingFocusNote);
      this.pendingFocusNote = undefined;
    }
    return () => this.focusNoteListeners.delete(cb);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INotesDriverV2 — Plugin → Core commands
  // ═══════════════════════════════════════════════════════════════════════

  reportNotePosition(position: INoteScreenPosition): void {
    for (const cb of this.notePositionListeners) {
      cb(position);
    }
  }

  selectNote(noteId: string | null): void {
    if (this.noteSelectionListeners.size === 0) {
      // No listeners yet (NoteOverlay not mounted) — buffer for later
      this.pendingSelectNote = noteId;
      return;
    }
    this.pendingSelectNote = undefined;
    for (const cb of this.noteSelectionListeners) {
      cb(noteId);
    }
  }

  requestCreateNote(anchor: INoteAnchor): void {
    for (const cb of this.createIntentListeners) {
      cb(anchor);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Core-internal methods (NOT on INotesDriverV2)
  // ═══════════════════════════════════════════════════════════════════════

  onNotePosition(cb: (pos: INoteScreenPosition) => void): Unsubscribe {
    this.notePositionListeners.add(cb);
    return () => this.notePositionListeners.delete(cb);
  }

  onNoteSelection(cb: (noteId: string | null) => void): Unsubscribe {
    this.noteSelectionListeners.add(cb);
    // Flush any buffered selectNote to the newly registered listener
    if (this.pendingSelectNote !== undefined) {
      cb(this.pendingSelectNote);
      this.pendingSelectNote = undefined;
    }
    return () => this.noteSelectionListeners.delete(cb);
  }

  onCreateIntent(cb: (anchor: INoteAnchor) => void): Unsubscribe {
    this.createIntentListeners.add(cb);
    return () => this.createIntentListeners.delete(cb);
  }

  setIncludeResolved(include: boolean): void {
    this._includeResolved = include;
  }

  /** Fetch all notes for the entry and populate the cache. */
  async fetchForEntry(): Promise<INoteRecord[]> {
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = (async () => {
      try {
        const filters: Record<string, unknown> = { entry_id: this.entryId };
        if (!this._includeResolved) filters.status__in = ["pending"];
        const res = await noteFeedsBackendDataSource.list({
          filters,
          pagination: { page: 1, itemsPerPage: 1000 },
          noCache: true,
        });
        const notes = res.data.map(noteFeedToV2);
        this.cache.clear();
        for (const note of notes) this.cache.set(note.id, note);
        this.#emitNotesChange();
        return notes;
      } finally {
        this._fetchPromise = null;
      }
    })();

    return this._fetchPromise;
  }

  /** Fetch comments for a specific note feed. */
  async fetchComments(feedId: string): Promise<INoteComment[]> {
    const comments = await fetchCommentsForFeed(feedId);
    this.commentCache.set(feedId, comments);
    return comments;
  }

  /** Get cached comments for a feed. */
  getComments(feedId: string): INoteComment[] {
    return this.commentCache.get(feedId) ?? [];
  }

  /** Look up a note in the cache by id. */
  getNote(id: string): INoteRecord | undefined {
    return this.cache.get(id);
  }

  /** Focus a note — fires onFocusNote listeners on the plugin. */
  focusNote(note: INoteRecord | null): void {
    if (note === null) {
      this.pendingFocusNote = undefined;
      for (const cb of this.focusNoteListeners) cb(null);
      return;
    }
    if (note) {
      this.cache.set(note.id, note);
    }
    if (this.focusNoteListeners.size === 0) {
      // No listeners yet (plugin not mounted) — buffer for later
      this.pendingFocusNote = note;
      return;
    }
    this.pendingFocusNote = undefined;
    for (const cb of this.focusNoteListeners) {
      cb(note);
    }
  }

  /** Create a note — persists, updates cache, emits onNotesChange. */
  async createNote(data: { content_md: string; anchor: INoteAnchor }): Promise<INoteRecord> {
    const { anchor, content_md } = data;
    const flat = flattenAnchorToBackend(anchor);

    const result = await noteFeedsBackendDataSource.create({
      attributes: {
        entry_id: this.entryId,
        annotation_id: flat.annotation_id,
        anchor_type: flat.anchor_type,
        position: flat.position,
        content_md,
        status: "pending",
      },
    });

    const created = (result as RecordResponse<NoteFeedRecord>).data;
    const note = noteFeedToV2(created);
    this.cache.set(note.id, note);
    this.#emitNotesChange();
    refetches.update((s) => ({ ...s, noteFeeds: { ...s.noteFeeds, list: new Date() } }));
    return note;
  }

  /** Reply to a note — creates a NoteComment on the backend. */
  async replyToNote(feedId: string, contentMd: string): Promise<INoteComment> {
    const result = await noteCommentsBackendDataSource.create({
      attributes: { content_md: contentMd },
      relationships: {
        note_feed: { data: { id: feedId, type: "dataset:note_feeds" } },
      },
    });
    const created = (result as RecordResponse<NoteCommentRecord>).data;
    const comment: INoteComment = {
      id: created.id,
      note_feed_id: created.note_feed_id,
      content_md: created.content_md,
      created_by_email: created.created_by_email,
      created_at: created.created_at?.toString() ?? "",
      updated_at: created.updated_at?.toString() ?? "",
      edited_at: created.edited_at?.toString() ?? null,
    };
    // Update comment cache — avoid duplicates
    const existing = this.commentCache.get(feedId) ?? [];
    if (!existing.find((c) => c.id === comment.id)) {
      existing.push(comment);
    }
    this.commentCache.set(feedId, existing);
    refetches.update((s) => ({ ...s, noteComments: { ...s.noteComments, list: new Date() } }));
    return comment;
  }

  /** Update a note — persists, updates cache, emits onNotesChange. */
  async updateNote(
    id: string,
    data: { anchor?: INoteAnchor; content_md?: string; status?: string; [key: string]: unknown },
  ): Promise<INoteRecord> {
    const payload: Record<string, unknown> = {};

    if (data.content_md !== undefined) payload.content_md = data.content_md;
    if (data.status !== undefined) payload.status = data.status;
    if (data.anchor !== undefined) {
      const flat = flattenAnchorToBackend(data.anchor!);
      payload.annotation_id = flat.annotation_id;
      payload.anchor_type = flat.anchor_type;
      payload.position = flat.position;
    }

    const result = await noteFeedsBackendDataSource.update(id, { attributes: payload });
    const updated = (result as RecordResponse<NoteFeedRecord>)?.data;
    if (!updated) {
      await this.fetchForEntry();
      const cached = this.cache.get(id);
      if (cached) return cached;
      throw new Error("updateNote: backend returned no data and note not in cache");
    }
    const note = noteFeedToV2(updated);
    this.cache.set(note.id, note);
    this.#emitNotesChange();
    refetches.update((s) => ({ ...s, noteFeeds: { ...s.noteFeeds, list: new Date() } }));
    return note;
  }

  /** Delete a note — persists, updates cache, emits onNotesChange. */
  async deleteNote(id: string): Promise<void> {
    await noteFeedsBackendDataSource.delete(id);
    this.cache.delete(id);
    this.commentCache.delete(id);
    this.#emitNotesChange();
    refetches.update((s) => ({ ...s, noteFeeds: { ...s.noteFeeds, list: new Date() } }));
  }

  // ── Private helpers ────────────────────────────────────────────────────

  #emitNotesChange(): void {
    const raw = Array.from(this.cache.values());
    // Deduplicate as safety net against runtime edge cases
    const seen = new Set<string>();
    const notes = raw.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    for (const cb of this.notesChangeListeners) {
      cb(notes);
    }
  }
}
