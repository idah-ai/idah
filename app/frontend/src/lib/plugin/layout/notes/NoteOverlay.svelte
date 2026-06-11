<script lang="ts">
  import { SendHorizontalIcon } from "@lucide/svelte";
  import MarkdownEditor from "@/components/app/markdown/markdown-editor.svelte";
  import { InputGroupButton } from "@/components/ui/input-group";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";

  import type { INoteAnchor, INoteComment, INoteRecord, INoteScreenPosition } from "@/plugin/v2/types";
  import type { NotesDriverAdapter } from "@/plugin/v2/driver/adapter/notes";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";
  import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { refetches } from "@/utils/refetch";
  import { modKeyLabel } from "@/plugin/v2/utils/browser";

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

  let comments: INoteComment[] = $state([]);
  let editingContentMd = $state("");
  let editingCommentId: string | null = $state(null);
  let editingFeedContent = $state(false);

  let isVisible = $derived(x !== undefined && y !== undefined && (selectedNote !== null || pendingAnchor !== null));
  let isCreating = $derived(pendingAnchor !== null);

  let highlightedCommentId: string | null = $state(null);
  let highlightedFeedId: string | null = $state(null);
  let scrollContainer: HTMLDivElement | null = $state(null);

  let unsubFns: Array<() => void> = [];

  let modKey = $derived(modKeyLabel());

  function formatEditedTooltip(dateStr?: string | null): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return (
        "Edited " +
        d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return "";
    }
  }

  function close(): void {
    if (selectedNote === null && pendingAnchor === null) return;

    selectedNote = null;
    pendingAnchor = null;
    x = undefined;
    y = undefined;
    contentMd = "";
    comments = [];
    editingCommentId = null;
    editingFeedContent = false;
    editingContentMd = "";
    highlightedCommentId = null;
    highlightedFeedId = null;

    queueMicrotask(() => {
      notesAdapter?.focusNote(null);
    });
  }

  onMount(() => {
    const na = notesAdapter;
    if (!na) return;

    unsubFns = [
      na.onNotePosition((pos: INoteScreenPosition) => {
        if (pendingAnchor !== null && pos.noteId !== null) return;
        if (selectedNote !== null && pos.noteId !== selectedNote.id) return;
        if (pendingAnchor === null && selectedNote === null) return;
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
            contentMd = "";
            editingCommentId = null;
            editingFeedContent = false;
            editingContentMd = "";
          }
        }
      }),
      na.onCreateIntent((anchor: INoteAnchor) => {
        selectedNote = null;
        pendingAnchor = anchor;
        contentMd = "";
        comments = [];
        editingCommentId = null;
        editingFeedContent = false;
      }),
    ];
  });

  onDestroy(() => {
    for (const fn of unsubFns) fn();
    notesAdapter?.focusNote(null);
  });

  // Load comments when a note is selected
  $effect(() => {
    const note = selectedNote;
    if (note) {
      const na = notesAdapter;
      if (na) {
        na.fetchComments(note.id).then((c) => {
          comments = c;
          // Re-parse URL hash for comment highlighting now that comments are loaded
          const parts = page.url.hash.split("/");
          // parts: ["#feed", feedId, "comments", commentId]
          if (parts.length >= 2 && parts[0] === "#feed" && parts[1]) {
            highlightedFeedId = parts[1];
          }
          if (parts.length >= 4 && parts[0] === "#feed" && parts[1] && parts[2] === "comments" && parts[3]) {
            highlightedCommentId = parts[3];
            // Scroll immediately
            requestAnimationFrame(() => {
              const el = scrollContainer?.querySelector(`[data-comment-id="${parts[3]}"]`);
              if (el) {
                el.scrollIntoView({ block: "center", behavior: "smooth" });
              }
            });
          }
        });
      }
    }
  });

  // Scroll to highlighted comment when comments load or hash changes
  $effect(() => {
    const cid = highlightedCommentId;
    const container = scrollContainer;
    if (cid && container) {
      requestAnimationFrame(() => {
        const el = container.querySelector(`[data-comment-id="${cid}"]`);
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    }
  });

  async function handleSubmit(): Promise<void> {
    const na = notesAdapter;
    if (!na || !contentMd.trim()) return;
    loading = true;
    try {
      if (isCreating && pendingAnchor) {
        const note = await na.createNote({ content_md: contentMd, anchor: pendingAnchor });
        // Clear creating state and switch to viewing the newly created note
        pendingAnchor = null;
        selectedNote = note;
        contentMd = "";
        comments = [];
        na.focusNote(note);
        na.selectNote(note.id);
        na.fetchComments(note.id).then((c) => (comments = c));
      } else if (selectedNote) {
        await na.replyToNote(selectedNote.id, contentMd);
        await na.fetchComments(selectedNote.id);
        comments = na.getComments(selectedNote.id);
        contentMd = "";
      }
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      loading = false;
    }
  }

  async function handleUpdateFeedContent(newMd: string): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    try {
      await na.updateNote(selectedNote.id, { content_md: newMd });
      selectedNote.content_md = newMd;
      selectedNote.edited_at = new Date().toISOString();
      editingFeedContent = false;
      editingContentMd = "";
    } catch (e) {
      console.error("Failed to update note:", e);
    }
  }

  async function handleUpdateComment(commentId: string, newMd: string): Promise<void> {
    if (!selectedNote) return;
    try {
      await noteCommentsBackendDataSource.update(commentId, { attributes: { content_md: newMd } });
      const na = notesAdapter!;
      await na.fetchComments(selectedNote.id);
      comments = na.getComments(selectedNote.id);
      editingCommentId = null;
      editingContentMd = "";
    } catch (e) {
      console.error("Failed to update comment:", e);
    }
  }

  async function handleDeleteFeed(): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    try {
      await na.deleteNote(selectedNote.id);
      close();
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  }

  async function handleDeleteComment(commentId: string): Promise<void> {
    if (!selectedNote) return;
    try {
      await noteCommentsBackendDataSource.delete(commentId);
      const na = notesAdapter!;
      await na.fetchComments(selectedNote.id);
      comments = na.getComments(selectedNote.id);
      $refetches.noteComments.list = new Date();
    } catch (e) {
      console.error("Failed to delete comment:", e);
    }
  }

  function startEditFeed(): void {
    editingContentMd = selectedNote?.content_md ?? "";
    editingFeedContent = true;
    editingCommentId = null;
  }

  function startEditComment(comment: INoteComment): void {
    editingContentMd = comment.content_md;
    editingCommentId = comment.id;
    editingFeedContent = false;
  }

  function cancelEdit(): void {
    editingFeedContent = false;
    editingCommentId = null;
    editingContentMd = "";
  }

  async function handleResolve(): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    loading = true;
    try {
      await noteFeedsBackendDataSource.markAsResolved(selectedNote.id);
      selectedNote.status = "resolved";
      selectedNote.resolved = true;
      await na.fetchForEntry();
      $refetches.noteFeeds.list = new Date();
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
      selectedNote.status = "pending";
      selectedNote.resolved = false;
      await na.fetchForEntry();
      $refetches.noteFeeds.list = new Date();
    } finally {
      loading = false;
    }
  }
</script>

{#if isVisible}
  <div
    class="fixed z-40"
    style="left: {x}px; top: {y}px;"
    role="dialog"
    aria-label={isCreating ? "New note" : "Note details"}
  >
    <div class="bg-background border-border w-80 rounded-lg border shadow-lg">
      <!-- HEADER -->
      <div class="flex items-center gap-1 border-b px-3 py-2">
        <span class="text-sm font-semibold">
          {isCreating ? "New Note" : "Note"}
        </span>

        <div class="ml-auto flex items-center gap-1">
          {#if !isCreating && selectedNote}
            <!-- Resolve/Reopen check button (same as sidebar) -->
            <Tooltips align="center" ignoreNonKeyboardFocus>
              {#snippet trigger()}
                <button
                  class="hover:bg-muted inline-flex size-5 items-center justify-center rounded-full"
                  class:bg-green-600={selectedNote!.status === "resolved"}
                  class:text-primary-foreground={selectedNote!.status === "resolved"}
                  onclick={(e) => {
                    e.stopPropagation();
                    if (selectedNote!.status === "resolved") handleReopen();
                    else handleResolve();
                  }}
                  aria-label={selectedNote!.status === "resolved" ? "Resolved" : "Mark as Resolved"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="size-3"><polyline points="20 6 9 17 4 12" /></svg
                  >
                </button>
              {/snippet}
              {#snippet content()}
                {selectedNote!.status === "resolved" ? "Resolved" : "Mark as Resolved"}
              {/snippet}
            </Tooltips>

            <NoteDropdownMenus
              noteFeedId={selectedNote!.id}
              editable
              deletable
              onSwitchToEditMode={startEditFeed}
              onDelete={handleDeleteFeed}
            />
          {/if}

          <!-- Close button -->
          <button
            class="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded"
            onclick={close}
            aria-label="Close"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
            >
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div bind:this={scrollContainer} class="max-h-80 space-y-2 overflow-y-auto px-3 py-2">
        {#if isCreating}
          <p class="text-muted-foreground px-1 text-xs">
            Attaching note to {pendingAnchor?.anchor_type === "annotation" ? "annotation" : "entry"}
          </p>
        {:else if selectedNote}
          <!-- Original note feed -->
          <div class="bg-muted/30 rounded px-2 py-1.5">
            <div class="flex items-center gap-1.5 text-xs">
              <span class="font-semibold">{selectedNote.created_by_email ?? "Unknown"}</span>
              <div class="ml-auto flex items-center">
                <NoteDropdownMenus
                  noteFeedId={selectedNote.id}
                  editable
                  onSwitchToEditMode={startEditFeed}
                  onDelete={handleDeleteFeed}
                />
              </div>
            </div>
            <div class="flex items-center gap-1.5 text-xs">
              <DateText
                class="text-muted-foreground"
                datetime={new Date(selectedNote.created_at ?? "")}
                datetimeFormat="MMM dd, yyyy HH:mm:ss"
                size="xs"
                weight="normal"
                showDistance
              />
              {#if selectedNote.edited_at}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger class="inline-block">
                      <span class="text-muted-foreground text-xs">(Edited)</span>
                    </TooltipTrigger>
                    <TooltipContent>{formatEditedTooltip(selectedNote.edited_at)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              {/if}
            </div>

            {#if editingFeedContent}
              <textarea
                class="border-border mt-1 w-full resize-none rounded border p-1.5 text-xs"
                rows="3"
                bind:value={editingContentMd}
              ></textarea>
              <div class="mt-1 flex items-center gap-1">
                <button class="hover:bg-muted rounded px-2 py-0.5 text-xs" onclick={cancelEdit}>Cancel</button>
                <button
                  class="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs"
                  onclick={() => handleUpdateFeedContent(editingContentMd)}
                  disabled={!editingContentMd.trim()}>Save</button
                >
              </div>
            {:else}
              <div class="mt-0.5 text-xs"><MarkdownPreview value={selectedNote.content_md ?? ""} /></div>
            {/if}
          </div>

          <!-- Comments -->
          {#each comments as comment (comment.id)}
            <div
              data-comment-id={comment.id}
              class={["rounded px-2 py-1.5", highlightedCommentId === comment.id ? "bg-muted" : ""].join(" ")}
            >
              <div class="flex items-center gap-1.5 text-xs">
                <span class="font-semibold">{comment.created_by_email}</span>
                <div class="ml-auto flex items-center">
                  <NoteDropdownMenus
                    noteFeedId={selectedNote.id}
                    noteCommentId={comment.id}
                    editable
                    deletable
                    onSwitchToEditMode={() => startEditComment(comment)}
                    onDelete={() => handleDeleteComment(comment.id)}
                  />
                </div>
              </div>
              <div class="flex items-center gap-1.5 text-xs">
                <DateText
                  class="text-muted-foreground"
                  datetime={new Date(comment.created_at)}
                  datetimeFormat="MMM dd, yyyy HH:mm:ss"
                  size="xs"
                  weight="normal"
                  showDistance
                />
                {#if comment.edited_at}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger class="inline-block">
                        <span class="text-muted-foreground text-xs">(Edited)</span>
                      </TooltipTrigger>
                      <TooltipContent>{formatEditedTooltip(comment.edited_at)}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                {/if}
              </div>

              {#if editingCommentId === comment.id}
                <textarea
                  class="border-border mt-1 w-full resize-none rounded border p-1.5 text-xs"
                  rows="2"
                  bind:value={editingContentMd}
                ></textarea>
                <div class="mt-1 flex items-center gap-1">
                  <button class="hover:bg-muted rounded px-2 py-0.5 text-xs" onclick={cancelEdit}>Cancel</button>
                  <button
                    class="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs"
                    onclick={() => handleUpdateComment(comment.id, editingContentMd)}
                    disabled={!editingContentMd.trim()}>Save</button
                  >
                </div>
              {:else}
                <div class="mt-0.5 text-xs"><MarkdownPreview value={comment.content_md} /></div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- FOOTER -->
      <div class="border-t px-3 py-2">
        <div
          onkeydown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        >
          <MarkdownEditor
            disabled={loading}
            placeholder={isCreating ? "Write your note..." : "Reply..."}
            value={contentMd}
            onInput={(e) => (contentMd = e.currentTarget.value)}
          >
            {#snippet actions()}
              <Tooltips class="ml-auto" align="center">
                {#snippet trigger()}
                  <InputGroupButton
                    aria-label="Send"
                    class="rounded-full"
                    variant="default"
                    size="icon-xs"
                    disabled={!contentMd.trim() || loading}
                    onclick={handleSubmit}
                  >
                    <SendHorizontalIcon class="size-3" />
                    <span class="sr-only"> Send </span>
                  </InputGroupButton>
                {/snippet}

                {#snippet content()}
                  <div class="flex items-center gap-2">
                    <KbdGroup>
                      <Kbd>{modKey}</Kbd>
                      <Kbd>Enter</Kbd>
                    </KbdGroup>

                    <span>to submit</span>
                  </div>
                {/snippet}
              </Tooltips>
            {/snippet}
          </MarkdownEditor>
        </div>
      </div>
    </div>
  </div>
{/if}
