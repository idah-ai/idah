<script lang="ts">
  import { onDestroy, onMount, setContext } from "svelte";
  import { page } from "$app/state";
  import { XIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/NoteDropdownMenus.svelte";
  import NoteForm from "@/plugin/layout/sidebar/notes/inputs/NoteForm.svelte";
  import NoteFeedbackBadges from "@/plugin/layout/sidebar/notes/badges/NoteFeedbackBadges.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { AuthContext } from "@/security/AuthContext";
  import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { refetches } from "@/utils/refetch";
  import type { INoteAnchor, INoteComment, INoteRecord, INoteScreenPosition } from "@/plugin/v2/types";
  import type { NotesDriverAdapter } from "@/plugin/v2/driver/adapter/notes";
  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  interface Props {
    driver: IdahDriverV2;
    notesAdapter: NotesDriverAdapter | null;
  }
  let { driver, notesAdapter }: Props = $props();

  setContext("driver", driver);

  let x: number | undefined = $state(undefined);
  let y: number | undefined = $state(undefined);
  let selectedNote: INoteRecord | null = $state(null);
  let pendingAnchor: INoteAnchor | null = $state(null);
  let selectedFeedbackKeys = $state<string[]>([]);
  let contentMd = $state("");
  let loading = $state(false);

  let comments: INoteComment[] = $state([]);
  let editingContentMd = $state("");
  let editingFeedbackKeys = $state<string[]>([]);
  let editingCommentId: string | null = $state(null);
  let editingFeedContent = $state(false);

  let isVisible = $derived(x !== undefined && y !== undefined && (selectedNote !== null || pendingAnchor !== null));
  let isCreating = $derived(pendingAnchor !== null);

  let highlightedCommentId: string | null = $state(null);
  let highlightedFeedId: string | null = $state(null);

  let scrollContainer: HTMLDivElement | null = $state(null);

  let unsubFns: Array<() => void> = [];

  let disableSubmitButton = $derived(selectedFeedbackKeys.length === 0 && !contentMd.trim());

  // Owner checks
  let isSelectedNoteOwner = $derived(AuthContext.currentAuthContext?.email === selectedNote?.created_by_email);

  function isCommentOwner(comment: INoteComment): boolean {
    return AuthContext.currentAuthContext?.email === comment.created_by_email;
  }

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
    selectedFeedbackKeys = [];
    comments = [];
    editingCommentId = null;
    editingFeedContent = false;
    editingContentMd = "";
    editingFeedbackKeys = [];
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
            selectedFeedbackKeys = found.feedback_keys ?? [];
            editingCommentId = null;
            editingFeedContent = false;
            editingContentMd = "";
            editingFeedbackKeys = [];
            editingFeedbackKeys = [];
          }
        }
      }),
      na.onCreateIntent((anchor: INoteAnchor) => {
        selectedNote = null;
        pendingAnchor = anchor;
        contentMd = "";
        selectedFeedbackKeys = [];
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
    if (!na || disableSubmitButton) return;
    loading = true;
    try {
      if (isCreating && pendingAnchor) {
        const note = await na.createNote({
          content_md: contentMd,
          feedbackKeys: selectedFeedbackKeys,
          anchor: pendingAnchor,
        });
        // Clear creating state and switch to viewing the newly created note
        pendingAnchor = null;
        selectedNote = note;
        contentMd = "";
        selectedFeedbackKeys = [];
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

  async function handleUpdateFeedContent(params: { newMd: string; newFeedbackKeys: string[] }): Promise<void> {
    const na = notesAdapter;
    if (!na || !selectedNote) return;
    try {
      const { newMd, newFeedbackKeys } = params;
      await na.updateNote(selectedNote.id, {
        content_md: newMd,
        feedback_keys: newFeedbackKeys,
      });
      selectedNote.content_md = newMd;
      selectedNote.feedback_keys = newFeedbackKeys;
      selectedNote.edited_at = new Date().toISOString();
      editingFeedContent = false;
      editingContentMd = "";
      editingFeedbackKeys = [];
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
      editingFeedbackKeys = [];
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
    editingFeedbackKeys = selectedNote?.feedback_keys ?? [];
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
    editingFeedbackKeys = [];
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
    <div class="bg-background border-border min-w-80 rounded-lg border shadow-lg">
      <!-- HEADER -->
      <div class="flex items-center gap-1 border-b px-3 py-2">
        <div class="flex flex-col">
          <p class="text-sm font-semibold">
            {isCreating ? "New Note" : "Note"}
          </p>

          {#if isCreating}
            <span class="text-muted-foreground text-xs">
              Attaching note to {pendingAnchor?.anchor_type === "annotation" ? "annotation" : "entry"}
            </span>
          {/if}
        </div>

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
              editable={isSelectedNoteOwner}
              deletable={isSelectedNoteOwner}
              onSwitchToEditMode={startEditFeed}
              onDelete={handleDeleteFeed}
            />
          {/if}

          <!-- Close button -->
          <Button variant="ghost" size="icon-xs" onclick={close}>
            <XIcon />
          </Button>
        </div>
      </div>

      <!-- BODY -->
      <div bind:this={scrollContainer} class="grid max-h-80 overflow-y-auto">
        {#if selectedNote}
          <!-- Original note feed -->
          <section
            data-feed-id={selectedNote.id}
            class={[
              "bg-muted/30 hover:bg-primary/5 flex flex-col gap-2 border-b px-3 py-2",
              highlightedFeedId === selectedNote.id ? "bg-muted" : "",
            ].join(" ")}
          >
            <div class="flex items-center">
              <div class="flex flex-col">
                <p class="text-sm font-semibold">{selectedNote.created_by_email ?? "Unknown"}</p>
                <div class="flex items-center gap-1.5 text-xs">
                  <DateText
                    class="text-muted-foreground text-xs"
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
                          <span class="text-muted-foreground text-xs">• Edited</span>
                        </TooltipTrigger>
                        <TooltipContent>{formatEditedTooltip(selectedNote.edited_at)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  {/if}
                </div>
              </div>

              <div class="ml-auto">
                <NoteDropdownMenus
                  noteFeedId={selectedNote.id}
                  editable={isSelectedNoteOwner}
                  deletable={isSelectedNoteOwner}
                  onSwitchToEditMode={startEditFeed}
                  onDelete={handleDeleteFeed}
                />
              </div>
            </div>

            {#if selectedNote.feedback_keys}
              <NoteFeedbackBadges feedbackKeys={selectedNote.feedback_keys ?? []} />
            {/if}

            {#if editingFeedContent}
              <div class="mt-4">
                <NoteForm
                  feedbackValues={editingFeedbackKeys}
                  onFeedbackSelected={(selected) => (editingFeedbackKeys = selected)}
                  contentValue={editingContentMd}
                  onContentChange={(newValue) => (editingContentMd = newValue)}
                  submitLabel="Save"
                  onSubmit={() =>
                    handleUpdateFeedContent({ newMd: editingContentMd, newFeedbackKeys: editingFeedbackKeys })}
                  showCancel
                  onCancel={cancelEdit}
                />
              </div>
            {:else}
              <div class="mt-2 text-sm"><MarkdownPreview value={selectedNote.content_md ?? ""} /></div>
            {/if}
          </section>

          <!-- Comments -->
          <section class="grid pb-2">
            {#each comments as comment (comment.id)}
              <div
                data-comment-id={comment.id}
                class={["rounded border-b py-2 pr-3 pl-6", highlightedCommentId === comment.id ? "bg-muted" : ""].join(
                  " ",
                )}
              >
                <div class="flex items-center gap-1.5 text-sm">
                  <span class="font-semibold">{comment.created_by_email}</span>
                  <div class="ml-auto flex items-center">
                    <NoteDropdownMenus
                      noteFeedId={selectedNote.id}
                      noteCommentId={comment.id}
                      editable={isCommentOwner(comment)}
                      deletable={isCommentOwner(comment)}
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
                          <span class="text-muted-foreground text-xs">• Edited</span>
                        </TooltipTrigger>
                        <TooltipContent>{formatEditedTooltip(comment.edited_at)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  {/if}
                </div>

                {#if editingCommentId === comment.id}
                  <NoteForm
                    showFeedbackField={false}
                    feedbackValues={editingFeedbackKeys}
                    onFeedbackSelected={(selected) => (editingFeedbackKeys = selected)}
                    contentValue={editingContentMd}
                    onContentChange={(newValue) => (editingContentMd = newValue)}
                    showCancel
                    onCancel={cancelEdit}
                    onSubmit={() => handleUpdateComment(comment.id, editingContentMd)}
                  />
                {:else}
                  <div class="mt-2 text-sm">
                    <MarkdownPreview value={comment.content_md} />
                  </div>
                {/if}
              </div>
            {/each}
          </section>
        {/if}

        <NoteForm
          class="gap-3 p-3"
          showFeedbackField={isCreating}
          feedbackValues={selectedFeedbackKeys}
          onFeedbackSelected={(selected) => (selectedFeedbackKeys = selected)}
          contentValue={contentMd}
          contentLabel={isCreating ? "Comment" : "Reply"}
          contentPlaceholder={isCreating ? "Leave a comment here" : "Leave a reply here"}
          onContentChange={(newValue) => (contentMd = newValue)}
          submitLabel={isCreating ? "Add Note" : "Reply"}
          {loading}
          loadingLabel={isCreating ? "Adding..." : "Replying..."}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  </div>
{/if}
