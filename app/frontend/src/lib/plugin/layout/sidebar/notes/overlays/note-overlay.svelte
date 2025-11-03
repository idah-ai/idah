<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import Button from "@/components/ui/button/button.svelte";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import messageCircleIcon from "@/plugin/layout/sidebar/notes/assets/message-circle.svg";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/resolve-note-feed-button.svelte";
  import NoteCommentCard from "@/plugin/layout/sidebar/notes/cards/note-comment-card.svelte";
  import NoteFeedCard from "@/plugin/layout/sidebar/notes/cards/note-feed-card.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";
  import NoteInputField from "@/plugin/layout/sidebar/notes/inputs/note-input-field.svelte";

  import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { deleteNoteFeed } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { refetches } from "@/utils/refetch";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
    pluginContainerElement: HTMLElement | null;
  }
  let { context, pluginContainerElement }: Props = $props();

  // Elements
  let NoteOverlayElement = $state<HTMLButtonElement | null>(null);

  // Variables
  let pluginContainerRect = $derived(pluginContainerElement?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0));
  let containerWidth = $derived(pluginContainerRect.width);
  let containerHeight = $derived(pluginContainerRect.height);

  let showNewNoteFeedPopup: boolean = $state(false);
  let newNoteFeed: NoteFeedRecord = $state(new NoteFeedRecord());
  let contentMd: string = $state("");

  let selectedNoteFeed: NoteFeedRecord | null = $state(null);
  let selectedNoteCommentId: string | null = $state(null);
  let noteComments: NoteCommentRecord[] = $state([]);

  $effect(() => {
    context.notes.onNoteSelected(async (noteFeedId: string | null, noteCommentId?: string) => {
      if (!noteFeedId) {
        selectedNoteFeed = null;
        selectedNoteCommentId = null;
        return;
      }

      await loadNoteFeed(noteFeedId);
      selectedNoteCommentId = noteCommentId || null;
    });

    context.notes.onNewNoteFeedOpenChange((data) => {
      showNewNoteFeedPopup = true;
      newNoteFeed.anchor_type = data.anchor_type;
      newNoteFeed.position = data.position || {};
      newNoteFeed.annotation_id = data.annotation_id || null;
    });
  });

  function closeSelectedNoteFeedPopup() {
    selectedNoteFeed = null;
  }

  async function loadNoteFeed(id: string) {
    const noteFeedRes = await noteFeedsBackendDataSource.get(id);
    selectedNoteFeed = noteFeedRes.data;
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

    await noteFeedsBackendDataSource.create({
      attributes: {
        entry_id: context.id,
        content_md: contentMd,
        anchor_type: newNoteFeed.anchor_type,
        position: newNoteFeed.position,
        annotation_id: newNoteFeed.annotation_id || undefined,
        created_by_email: "reviewer_user@example.com",
      },
    });
    toast.success("Note added successfully.");
    $refetches.noteFeeds.list = new Date();

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
        created_by_email: "annotator@example.com",
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
    toast.success("Note added successfully.");

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
</script>

{#if selectedNoteFeed || showNewNoteFeedPopup}
  <button
    bind:this={NoteOverlayElement}
    class="bg-primary/10 absolute left-0 z-40"
    style:top="{pluginContainerRect.top}px"
    style:width="{containerWidth}px"
    style:height="{containerHeight}px"
  >
    <!-- NOTE FEED POPUP::NEW -->
    {#if showNewNoteFeedPopup}
      {@const posX = newNoteFeed.position.x || 0}
      {@const posY = newNoteFeed.position.y || 0}
      {@const targetSizeX = newNoteFeed.position.target_size[0] || containerWidth || 0}
      {@const targetSizeY = newNoteFeed.position.target_size[1] || containerHeight || 0}
      {@const top = (Number(posY * targetSizeY) / containerHeight) * 100}
      {@const left = (Number(posX * targetSizeX) / containerWidth) * 100}

      <!-- transition:fade={{ duration: 200, easing: sineInOut }} -->
      <img
        src={messageCircleIcon}
        alt="Message circle icon"
        class="absolute z-40 cursor-auto"
        style:top="{top}%"
        style:left="{left}%"
        style:transform="translate(1300%, -50%)"
      />
      <!-- style:transform="translate({zoomInfo.offset[X]}px, {zoomInfo.offset[Y]}px)" -->

      <Dialog open={showNewNoteFeedPopup} onOpenChangeComplete={(open) => (showNewNoteFeedPopup = open)}>
        <DialogContent
          overlayClass="bg-transparent"
          class="w-80 translate-x-[110%] translate-y-0 p-0"
          style="top: {top}%; left: {left}%;"
          showCloseButton={false}
        >
          <NoteInputField
            value={contentMd}
            onInput={(e) => (contentMd = e.currentTarget.value)}
            onSubmit={createNoteFeed}
          />
        </DialogContent>
      </Dialog>
    {/if}

    <!-- NOTE FEED POPUP::SELECTED -->
    {#if selectedNoteFeed}
      {@const posX = selectedNoteFeed.position.x || 0}
      {@const posY = selectedNoteFeed.position.y || 0}
      {@const targetSizeX = selectedNoteFeed.position.target_size[0] || containerWidth || 0}
      {@const targetSizeY = selectedNoteFeed.position.target_size[1] || containerHeight || 0}
      {@const top = (Number(posY * targetSizeY) / containerHeight) * 100}
      {@const left = (Number(posX * targetSizeX) / containerWidth) * 100}

      <img
        src={messageCircleIcon}
        alt="Message circle icon"
        class="absolute z-40 cursor-auto"
        style:top="{top}%"
        style:left="{left}%"
        style:transform="translate(1300%, -50%)"
      />

      <Dialog
        open={!!selectedNoteFeed}
        onOpenChangeComplete={(open) => (selectedNoteFeed = open ? selectedNoteFeed : null)}
      >
        <DialogContent
          overlayClass="bg-transparent"
          class="w-80 translate-x-[110%] translate-y-0 gap-1 px-0 py-2"
          style="top: {top}%; left: {left}%;"
          showCloseButton={false}
        >
          <DialogHeader class="flex flex-row items-center px-2">
            <DialogTitle>
              <Text size="sm" weight="semibold">Notes</Text>
            </DialogTitle>

            <!-- ACTIONS -->
            <div class="ml-auto flex items-center gap-1">
              <ResolveNoteFeedButton noteFeed={selectedNoteFeed} />
              <NoteDropdownMenus noteFeedId={selectedNoteFeed.id} deletable onDelete={deleteNote} />
              <Button variant="ghost" size="icon-sm" onclick={closeSelectedNoteFeedPopup}>
                <XIcon />
              </Button>
            </div>
          </DialogHeader>

          {#key $refetches.noteFeeds.list}
            <ScrollArea class="max-h-64">
              <div class="flex flex-col gap-2">
                <NoteFeedCard noteFeedRecord={selectedNoteFeed} editable {onNoteFeedUpdated} />

                {#key $refetches.noteComments.list}
                  {#await loadNoteComments(selectedNoteFeed.id) then}
                    {#each noteComments as noteComment (noteComment.id)}
                      <NoteCommentCard noteCommentRecord={noteComment} />
                    {/each}
                  {/await}
                {/key}
              </div>
            </ScrollArea>
          {/key}

          <DialogFooter class="px-2">
            <NoteInputField
              value={contentMd}
              placeholder="Reply to this note"
              onInput={(e) => (contentMd = e.currentTarget.value)}
              onSubmit={createNoteComment}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    {/if}
  </button>
{/if}
