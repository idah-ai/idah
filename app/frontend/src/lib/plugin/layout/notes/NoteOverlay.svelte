<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import type { INoteAnchor, INoteRecord, INoteScreenPosition } from "@/plugin/v2/types";
  import type { NotesDriverAdapter } from "@/plugin/v2/driver/adapter/notes";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { refetches } from "@/utils/refetch";

  interface Props {
    notesAdapter: NotesDriverAdapter | null;
  }
  let { notesAdapter }: Props = $props();

  let x: number | undefined = $state(undefined);
  let y: number | undefined = $state(undefined);
  let selectedNote: INoteRecord | null = $state(null);
  let pendingAnchor: INoteAnchor | null = $state(null);
  let contentMd = $state("");
  let loading = $state(false);

  let isVisible = $derived(x !== undefined && y !== undefined && (selectedNote !== null || pendingAnchor !== null));
  let isCreating = $derived(pendingAnchor !== null);
  let noteTitle = $derived(
    isCreating
      ? "New Note"
      : selectedNote
        ? `${(selectedNote as Record<string, unknown>).created_by_email ?? "Unknown"}`
        : "",
  );

  let unsubFns: Array<() => void> = [];

  let _closing = false;

  function close(): void {
    if (_closing) return;
    _closing = true;
    selectedNote = null;
    pendingAnchor = null;
    x = undefined;
    y = undefined;
    contentMd = "";
    // Notify the plugin that the note is no longer selected
    // so it stops reporting position on frame change.
    // Use a microtask to avoid re-entrant dispatch through onNoteSelection.
    queueMicrotask(() => {
      notesAdapter?.focusNote(null);
      _closing = false;
    });
  }

  onMount(() => {
    const na = notesAdapter;
    if (!na) {
      return;
    }
    unsubFns = [
      na.onNotePosition((pos: INoteScreenPosition) => {
        x = pos.x;
        y = pos.y;
      }),
      na.onNoteSelection((noteId: string | null) => {
        if (noteId === null) {
          close();
        } else {
          // Look up the full note record from the adapter cache
          const found = na.getNote(noteId);
          if (found) {
            selectedNote = found;
            pendingAnchor = null;
          }
        }
      }),
      na.onCreateIntent((anchor: INoteAnchor) => {
        selectedNote = null;
        pendingAnchor = anchor;
        contentMd = "";
      }),
    ];
  });

  onDestroy(() => {
    for (const fn of unsubFns) fn();
    // Clean up pending note creation on unmount
    notesAdapter?.selectNote(null);
  });

  async function handleSubmit(): Promise<void> {
    const na = notesAdapter;
    if (!na || !contentMd.trim()) return;
    loading = true;
    try {
      if (isCreating && pendingAnchor) {
        await na.createNote({ content_md: contentMd, anchor: pendingAnchor });
        close();
      } else if (selectedNote) {
        await na.updateNote(selectedNote.id, {
          content_md: (selectedNote.content_md ?? "") + "\n\n---\n" + contentMd,
        });
        close();
      }
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      loading = false;
    }
  }

  async function handleDelete(): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    loading = true;
    try {
      await na.deleteNote(selectedNote.id);
      close();
    } finally {
      loading = false;
    }
  }

  async function handleResolve(): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    loading = true;
    try {
      await noteFeedsBackendDataSource.markAsResolved(selectedNote.id);
      await na.fetchForEntry();
      $refetches.noteFeeds.list = new Date();
      close();
    } finally {
      loading = false;
    }
  }

  async function handleReopen(): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    loading = true;
    try {
      await na.updateNote(selectedNote.id, { status: "pending" });
      await na.fetchForEntry();
      $refetches.noteFeeds.list = new Date();
      close();
    } finally {
      loading = false;
    }
  }
</script>

{#if isVisible}
  <div role="presentation" class="fixed inset-0 z-30" onclick={close}></div>

  <div
    class="fixed z-40"
    style="left: {x}px; top: {y}px;"
    role="dialog"
    aria-label={isCreating ? "New note" : "Note details"}
  >
    <div class="bg-background border-border w-72 rounded-lg border shadow-lg">
      <div class="flex items-center gap-2 border-b px-3 py-2">
        <span class="text-sm font-semibold">{noteTitle}</span>
        <span class="text-muted-foreground ml-auto text-xs">
          {selectedNote?.status === "resolved" ? "Resolved" : "Pending"}
        </span>
      </div>
      <div class="max-h-48 space-y-2 overflow-y-auto px-3 py-2">
        {#if !isCreating && selectedNote}
          <div class="px-3 py-2 text-sm">
            <MarkdownPreview value={selectedNote.content_md ?? ""} />
          </div>
        {:else}
          <p class="text-muted-foreground text-xs">
            Attaching note to {pendingAnchor?.anchor_type === "annotation" ? "annotation" : "entry"}
          </p>
        {/if}
      </div>
      <div class="border-t px-3 py-2">
        <textarea
          class="border-border w-full resize-none rounded border p-2 text-sm"
          rows="2"
          placeholder={isCreating ? "Write your note..." : "Reply..."}
          bind:value={contentMd}
          disabled={loading}
        ></textarea>
        <div class="mt-2 flex items-center gap-1">
          {#if !isCreating}
            <button
              class="hover:bg-muted rounded px-2 py-1 text-xs"
              onclick={selectedNote?.status === "resolved" ? handleReopen : handleResolve}
              disabled={loading}
            >
              {selectedNote?.status === "resolved" ? "Reopen" : "Resolve"}
            </button>
            <button class="hover:bg-muted rounded px-2 py-1 text-xs" onclick={handleDelete} disabled={loading}>
              Delete
            </button>
          {/if}
          <button
            class="bg-primary text-primary-foreground ml-auto rounded px-3 py-1 text-xs"
            onclick={handleSubmit}
            disabled={loading || !contentMd.trim()}
          >
            {loading ? "Saving..." : isCreating ? "Create" : "Reply"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
