<script lang="ts">
  import { page } from "$app/state";
  import { XIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { SvelteURL } from "svelte/reactivity";

  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import messageCircleIcon from "@/plugin/layout/sidebar/notes/assets/message-circle.svg";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/resolve-note-feed-button.svelte";
  import NoteCommentCard from "@/plugin/layout/sidebar/notes/cards/note-comment-card.svelte";
  import NoteFeedCard from "@/plugin/layout/sidebar/notes/cards/note-feed-card.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";
  import NoteInputField from "@/plugin/layout/sidebar/notes/inputs/note-input-field.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { deleteNoteFeed } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { parseNoteFeedRecordToINoteFeed } from "@/plugin/NoteDriver";
  import { refetches } from "@/utils/refetch";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Interfaces
  interface ZoomInfo {
    scale: number;
    offset: [number, number];
  }

  // Variables
  const [X, Y] = [0, 1];
  const NOTE_POPUP_OFFSET = [32, -32];

  /**
   * targetDomRect is a DOMRect of the target element from plugin,
   * where the note is attached to.
   *
   * It is used to calculate position the note popup relative to the target element.
   */
  let targetDomRect = $state<DOMRect | null>(null);
  let zoomInfo = $state<ZoomInfo>({ scale: 1, offset: [0, 0] });
  let scaledTargetDomRect = $derived.by(() => {
    if (!targetDomRect) return null;

    return {
      top: targetDomRect.top + zoomInfo.offset[Y],
      left: targetDomRect.left + zoomInfo.offset[X],
      width: targetDomRect.width * zoomInfo.scale,
      height: targetDomRect.height * zoomInfo.scale,
    };
  });

  let showNewNoteFeedPopup: boolean = $state(false);
  let newNoteFeed: NoteFeedRecord = $state(new NoteFeedRecord());
  let contentMd: string = $state("");

  let selectedNoteFeed: NoteFeedRecord | null = $state(null);
  let selectedNoteCommentId: string | null = $state(null);
  let noteComments: NoteCommentRecord[] = $state([]);

  onMount(() => {
    const [_noteFeed, noteFeedIdFromURL, _noteComment, noteCommentIdFromURL] = page.url.hash.split("/");
    setTimeout(async () => {
      if (noteFeedIdFromURL) {
        const noteFeed = await loadNoteFeed(noteFeedIdFromURL);
        context.notes.requireNoteFeedPosition(parseNoteFeedRecordToINoteFeed(noteFeed));
      }

      if (noteCommentIdFromURL) {
        selectedNoteCommentId = noteCommentIdFromURL;
      }
    }, 200);

    /**
     * Handle when a note feed is selected from sidebar
     */
    context.notes.onNoteSelected(async (noteFeedId: string | null, noteCommentId?: string) => {
      if (!noteFeedId) {
        selectedNoteFeed = null;
        selectedNoteCommentId = null;
        return;
      }

      const noteFeed = await loadNoteFeed(noteFeedId);
      selectedNoteCommentId = noteCommentId || null;
      context.notes.requireNoteFeedPosition(parseNoteFeedRecordToINoteFeed(noteFeed));
    });

    /**
     * Handle when a click is made to show new note feed popup
     */
    context.notes.onNewNoteFeedOpenChange((data) => {
      showNewNoteFeedPopup = true;
      newNoteFeed.anchor_type = data.anchor_type;
      newNoteFeed.position = data.position || {};
      newNoteFeed.annotation_id = data.annotation_id || null;
    });

    context.notes.onTargetDomRectChange((rect: DOMRect) => {
      if (!rect) return;
      targetDomRect = rect;
    });

    context.notes.onZoomInfoChange((zi) => {
      zoomInfo = zi;
    });
  });

  function closeSelectedNoteFeedPopup() {
    selectedNoteFeed = null;
    selectedNoteCommentId = null;

    // Remove hash from url if exists
    if (!page.url.hash) return;
    const url = new SvelteURL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  }

  async function loadNoteFeed(id: string) {
    const noteFeedRes = await noteFeedsBackendDataSource.get(id);
    selectedNoteFeed = noteFeedRes.data;
    return noteFeedRes.data;
  }

  async function loadNoteComments(noteFeedId: string) {
    const noteCommentsRes = await noteCommentsBackendDataSource.list({
      filters: {
        note_feed_id: noteFeedId,
      },
    });
    noteComments = noteCommentsRes.data;
  }

  async function createNoteFeed() {
    if (!contentMd.trim()) {
      return;
    }

    const createdNoteFeedRes = await noteFeedsBackendDataSource.create({
      attributes: {
        entry_id: context.id,
        content_md: contentMd,
        anchor_type: newNoteFeed.anchor_type,
        position: newNoteFeed.position,
        annotation_id: newNoteFeed.annotation_id || undefined,
      },
      relationships: {
        annotation: {
          data: {
            id: newNoteFeed.annotation_id || undefined,
            type: "dataset:annotations",
          },
        },
      },
    });

    showToast.success({ title: "Note added successfully." });
    $refetches.noteFeeds.list = new Date();

    context.notes.gotoFeed(createdNoteFeedRes.data.id);

    // Reset
    contentMd = "";
    showNewNoteFeedPopup = false;
    $refetches.noteFeeds.list = new Date();
  }

  async function createNoteComment() {
    if (!contentMd.trim() || !selectedNoteFeed) {
      return;
    }

    await noteCommentsBackendDataSource.create({
      attributes: {
        content_md: contentMd,
      },
      relationships: {
        note_feed: {
          data: {
            id: selectedNoteFeed.id,
            type: "dataset:note_feeds",
          },
        },
      },
    });
    await loadNoteFeed(selectedNoteFeed.id);
    $refetches.noteFeeds.list = new Date();
    showToast.success({ title: "Note added successfully." });

    // Reset
    contentMd = "";
    $refetches.noteComments.list = new Date();
  }

  async function onNoteFeedUpdated(updatedNoteFeed: NoteFeedRecord) {
    await loadNoteFeed(updatedNoteFeed.id);
  }

  async function deleteNote() {
    if (!selectedNoteFeed) return;

    await deleteNoteFeed(selectedNoteFeed.id);
    $refetches.noteFeeds.list = new Date();
    selectedNoteFeed = null;
  }

  function closeNoteFeedPopup() {
    showNewNoteFeedPopup = false;
  }
</script>

{#if (selectedNoteFeed || showNewNoteFeedPopup) && scaledTargetDomRect}
  <button
    class="absolute left-0 z-50 bg-transparent"
    style:top="{scaledTargetDomRect.top}px"
    style:left="{scaledTargetDomRect.left}px"
    style:width="{scaledTargetDomRect.width}px"
    style:height="{scaledTargetDomRect.height}px"
  >
    <!-- NOTE FEED POPUP::NEW -->
    {#if showNewNoteFeedPopup}
      {@const posX = newNoteFeed.position.x || 0}
      {@const posY = newNoteFeed.position.y || 0}
      {@const targetDOMHeight = scaledTargetDomRect.height}
      {@const targetDOMWidth = scaledTargetDomRect.width}
      {@const top = `${Number(posY * targetDOMHeight)}px`}
      {@const left = `${Number(posX * targetDOMWidth)}px`}
      {@const cursorNoteCoordinates = [0, -20]}

      <img
        src={messageCircleIcon}
        alt="Message circle icon"
        class="absolute z-40 cursor-auto"
        style:top
        style:left
        style:transform="translate({cursorNoteCoordinates[X]}px, {cursorNoteCoordinates[Y]}px)"
      />

      <div
        class="absolute w-80 p-0"
        style:top
        style:left
        style:transform="translate({NOTE_POPUP_OFFSET[X]}px, {NOTE_POPUP_OFFSET[Y]}px)"
      >
        <Card class="gap-0 p-1">
          <CardHeader class="flex flex-row items-center p-1">
            <CardTitle>New Note</CardTitle>

            <div class="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onclick={closeNoteFeedPopup}>
                <XIcon />
              </Button>
            </div>
          </CardHeader>

          <CardContent class="p-1">
            <NoteInputField
              value={contentMd}
              onInput={(e) => (contentMd = e.currentTarget.value)}
              onSubmit={createNoteFeed}
            />
          </CardContent>
        </Card>
      </div>
    {/if}

    <!-- NOTE FEED POPUP::SELECTED -->
    {#if selectedNoteFeed && selectedNoteFeed.position && Object.keys(selectedNoteFeed.position || {}).length > 0}
      {@const posX = selectedNoteFeed.position.x || 0}
      {@const posY = selectedNoteFeed.position.y || 0}
      {@const targetDOMHeight = scaledTargetDomRect.height}
      {@const targetDOMWidth = scaledTargetDomRect.width}
      {@const top = `${Number(posY * targetDOMHeight)}px`}
      {@const left = `${Number(posX * targetDOMWidth)}px`}
      {@const cursorNoteCoordinates = [0, -20]}

      <img
        src={messageCircleIcon}
        alt="Message circle icon"
        class="absolute z-40 cursor-auto"
        style:top
        style:left
        style:transform="translate({cursorNoteCoordinates[X]}px, {cursorNoteCoordinates[Y]}px)"
      />

      <div
        class="absolute w-80 p-0"
        style:top
        style:left
        style:transform="translate({NOTE_POPUP_OFFSET[X]}px, {NOTE_POPUP_OFFSET[Y]}px)"
      >
        <Card class="gap-0 p-1">
          <CardHeader class="flex flex-row items-center p-1">
            <CardTitle>Notes</CardTitle>
            <div class="ml-auto flex items-center gap-1">
              <!-- Note: This span is to prevent resolve note feed button being open unintentionally -->
              <span class="sr-only" role="button" tabindex="0" aria-hidden="true"> </span>
              <ResolveNoteFeedButton noteFeed={selectedNoteFeed} onNoteResolved={closeSelectedNoteFeedPopup} />
              <NoteDropdownMenus noteFeedId={selectedNoteFeed.id} deletable onDelete={deleteNote} />
              <Button variant="ghost" size="icon-sm" onclick={closeSelectedNoteFeedPopup}>
                <XIcon />
              </Button>
            </div>
          </CardHeader>

          <CardContent class="p-1">
            {#key $refetches.noteFeeds.list}
              <ScrollArea class="max-h-64">
                <div class="flex flex-col">
                  <NoteFeedCard noteFeedRecord={selectedNoteFeed} editable {onNoteFeedUpdated} />

                  {#key $refetches.noteComments.list}
                    {#await loadNoteComments(selectedNoteFeed.id) then}
                      {#each noteComments as noteComment (noteComment.id)}
                        <NoteCommentCard
                          noteCommentRecord={noteComment}
                          highlighted={selectedNoteCommentId === noteComment.id}
                        />
                      {/each}
                    {/await}
                  {/key}
                </div>
              </ScrollArea>
            {/key}
          </CardContent>

          <CardFooter class="p-1">
            <NoteInputField
              value={contentMd}
              placeholder="Reply to this note"
              onInput={(e) => (contentMd = e.currentTarget.value)}
              onSubmit={createNoteComment}
            />
          </CardFooter>
        </Card>
      </div>
    {/if}
  </button>
{/if}
