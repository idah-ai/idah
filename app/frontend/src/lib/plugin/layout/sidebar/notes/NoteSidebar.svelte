<script lang="ts">
  import { page } from "$app/state";
  import {
    ArrowLeftIcon,
    FunnelIcon,
    MessageCircleDashedIcon,
    SquareCheckBigIcon,
    SquareIcon,
    XIcon,
  } from "@lucide/svelte";
  import { onMount, setContext } from "svelte";
  import { SvelteURL } from "svelte/reactivity";
  import { slide } from "svelte/transition";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import NoteCommentCard from "@/plugin/layout/sidebar/notes/cards/NoteCommentCard.svelte";
  import NoteForm from "@/plugin/layout/sidebar/notes/inputs/NoteForm.svelte";
  import NoteFeedCard from "@/plugin/layout/sidebar/notes/cards/NoteFeedCard.svelte";
  import NoteCardLoading from "@/plugin/layout/sidebar/notes/cards/NoteCardLoading.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/NoteDropdownMenus.svelte";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/ResolveNoteFeedButton.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { AuthContext } from "@/security/AuthContext";
  import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
  import { noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { noteFeedToV2 } from "@/plugin/v2/driver/adapter/notes";
  import { deleteNoteFeed } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { refetches } from "@/utils/refetch";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { Hash } from "@/utils/types";
  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  // Props
  interface Props {
    driver: IdahDriverV2;
    open: boolean;
    onSidebarClose: () => void;
  }
  let { driver, open, onSidebarClose }: Props = $props();

  setContext("driver", driver);

  // Variables
  let selectedNoteFeed: NoteFeedRecord | null = $state(null);
  let selectedNoteCommentId: string | null = $state(null);
  let isAllowToCreateNewNote = $derived(["annotate", "review"].includes(driver.workflowStep));
  let isListView = $derived(!selectedNoteFeed);
  let isDetailView = $derived(!!selectedNoteFeed);
  let noteFeedFilters = $state<Hash>({ status__in: ["pending"] });
  let isFilteringResolved = $derived(noteFeedFilters.status__in.includes("resolved"));
  let isSubmitting = $state<boolean>(false);
  let isHidingOutdated = $state(false);
  let contentMd = $state<string>("");
  let feedbackKeys = $state<string[]>([]);

  let isSelectedFeedOwner = $derived(AuthContext.currentAuthContext?.email === selectedNoteFeed?.created_by_email);

  const filterMenus: IDropdownMenus = $derived({
    filters: {
      items: [
        {
          label: "Show resolved notes",
          icon: noteFeedFilters.status__in.includes("resolved") ? SquareCheckBigIcon : SquareIcon,
          action: () => {
            noteFeedFilters.status__in = noteFeedFilters.status__in.includes("resolved")
              ? ["pending"]
              : ["pending", "resolved"];

            // Sync with plugin adapter so NoteMarkers/timeline reflect the same filter
            const adapter = driver.notesAdapter;
            if (adapter) {
              const includeResolved = noteFeedFilters.status__in.includes("resolved");
              adapter.setIncludeResolved(includeResolved);
              adapter.fetchForEntry();
            }

            $refetches.noteFeeds.list = new Date();
          },
        },
        {
          label: "Hide outdated notes",
          icon: isHidingOutdated ? SquareCheckBigIcon : SquareIcon,
          action: () => {
            isHidingOutdated = !isHidingOutdated;
          },
        },
      ],
    },
  });

  // Lifecycle
  onMount(() => {
    setTimeout(async () => {
      const [_noteFeed, noteFeedIdFromURL, _noteComment, noteCommentIdFromURL] = page.url.hash.split("/");
      if (noteFeedIdFromURL) {
        const noteFeedRes = await noteFeedsBackendDataSource.get(noteFeedIdFromURL);
        const feed = noteFeedRes.data;

        /**
         * General notes (no spatial anchor) open in the sidebar detail view.
         * Anchor notes (video_frame / annotation) are handed to the plugin
         * via focusNote() so it seeks to the anchor position and shows the overlay.
         */
        const isGeneral =
          feed.anchor_type === "entry" &&
          feed.annotation_id === null &&
          !Object.keys(feed.position || {}).includes("x");

        if (isGeneral) {
          selectedNoteFeed = feed;
          open = true;
        } else {
          // Hand off to the plugin — same flow as selectNoteFeed() for non-general notes
          const adapter = driver.notesAdapter;
          if (adapter) {
            // Ensure the plugin is in review mode so overlays/markers are visible
            if (driver.mode !== "review") {
              driver.setMode("review");
            }
            // Wait for the adapter cache to be populated
            if (!adapter.getNote(feed.id)) {
              await adapter.fetchForEntry();
            }
            adapter.focusNote(noteFeedToV2(feed));
          }
        }
      }

      if (noteCommentIdFromURL) {
        selectedNoteCommentId = noteCommentIdFromURL;
      }
    }, 200);
  });

  // Functions
  function selectNoteFeed(noteFeed: NoteFeedRecord) {
    switch (noteFeed.noteType) {
      case "entry": {
        // Clear any previously focused/selected anchor note in the plugin overlay
        driver.notesAdapter?.selectNote(null);

        // Reset viewport zoom/pan to fit the full media
        driver.command.call(`${driver.dataset.modality}:viewport.reset`);

        selectedNoteFeed = noteFeed;
        feedbackKeys = [];
        contentMd = "";
        break;
      }

      default: {
        // Not a general note — hand off to the plugin so it can seek to the anchor
        const adapter = driver.notesAdapter;
        if (adapter) {
          adapter.focusNote(noteFeedToV2(noteFeed));
        }
        break;
      }
    }
  }

  function backToNoteFeedList() {
    selectedNoteFeed = null;
    feedbackKeys = [];
    contentMd = "";
    $refetches.noteFeeds.list = new Date();

    // Remove hash from url if exists
    if (!page.url.hash) return;
    const url = new SvelteURL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  }

  async function loadNoteFeeds() {
    const noteFeedsRes = await noteFeedsBackendDataSource.list({
      filters: {
        entry_id: driver.id,
        ...noteFeedFilters,
      },
      pagination: {
        page: 1,
        itemsPerPage: 1000,
      },
      sort: ["-created_at"],
      // Include the anchored annotation so we can detect soft-deleted anchors
      // (isAnchorDeleted). Limit annotation fields to id + deleted_at so large
      // shape_args (masks) aren't transferred just for the badge.
      included: ["annotation"],
      fields: {
        [AnnotationRecord.type]: ["id", "deleted_at"],
      },
      // Bypass the cache so a refetch (after annotation delete/restore) returns
      // fresh `deleted_at` values — otherwise the stale cached response keeps
      // the "Annotation deleted" badge from appearing without a page reload.
      noCache: true,
    });
    // Sync the adapter cache so NoteMarkers re-renders
    const adapter = driver.notesAdapter;
    await adapter?.fetchForEntry();
    return noteFeedsRes.data;
  }

  async function loadNoteComments() {
    if (!selectedNoteFeed) return {};

    const noteFeedRes = await noteFeedsBackendDataSource.get(selectedNoteFeed.id);

    const noteCommentsRes = await noteCommentsBackendDataSource.list({
      filters: {
        note_feed_id: selectedNoteFeed.id,
      },
      sort: ["created_at"],
    });

    return { noteFeed: noteFeedRes.data, noteComments: noteCommentsRes.data };
  }

  async function createNote() {
    if (!isAllowToCreateNewNote || (isDetailView ? !contentMd.trim() : !contentMd.trim() && feedbackKeys.length === 0))
      return;

    isSubmitting = true;
    try {
      if (isListView) {
        /** Create a general note feed, if current view is list */
        await noteFeedsBackendDataSource.create({
          attributes: {
            entry_id: driver.id,
            annotation_id: undefined,
            anchor_type: "entry",
            content_md: contentMd,
            feedback_keys: feedbackKeys,
          },
        });
        $refetches.noteFeeds.list = new Date();
      }

      if (isDetailView && selectedNoteFeed) {
        /** Create a note comment under the selected note feed, if current view is detail */
        await noteCommentsBackendDataSource.create({
          attributes: {
            note_feed_id: selectedNoteFeed.id,
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
        $refetches.noteComments.list = new Date();
      }

      contentMd = "";
      feedbackKeys = [];
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      isSubmitting = false;
    }
  }

  async function deleteNote() {
    if (!selectedNoteFeed) return;

    await deleteNoteFeed(selectedNoteFeed.id);

    // Re-sync the notes adapter cache so NoteMarkers re-renders
    const adapter = driver.notesAdapter;
    await adapter?.fetchForEntry();

    backToNoteFeedList();
  }
</script>

{#if open}
  <div
    transition:slide={{ axis: "x" }}
    class="bg-background absolute top-11 right-0 z-30 ml-auto flex h-[calc(100vh-3rem)] w-80 flex-col rounded-bl-md border shadow-lg"
  >
    <!-- HEADER -->
    <section class="flex items-center gap-1 border-b p-2">
      <!-- HEADER::BACK BUTTON -->
      {#if isDetailView}
        <Button variant="ghost" size="icon-sm" onclick={backToNoteFeedList}>
          <ArrowLeftIcon />
        </Button>
      {/if}

      <!-- HEADER::TITLE -->
      <Text weight="semibold">
        {isListView ? "Notes" : "Replies"}
      </Text>

      <!-- HEADER::ACTIONS -->
      <div class="ml-auto flex items-center gap-1">
        {#if isListView}
          <DropdownMenus menus={filterMenus} align="end">
            {#snippet trigger({ props })}
              <Button {...props} variant="ghost" size="icon-sm">
                <FunnelIcon />

                <!-- FILTERING INDICATOR -->
                {#if isFilteringResolved}
                  <div class="bg-primary absolute top-1 right-1 size-2 animate-pulse rounded-full"></div>
                {/if}
              </Button>
            {/snippet}
          </DropdownMenus>
        {/if}

        {#if isDetailView && selectedNoteFeed}
          <ResolveNoteFeedButton
            noteFeed={selectedNoteFeed}
            onNoteResolved={(resolvedNoteFeed) => {
              selectedNoteFeed = resolvedNoteFeed;
              // Sync adapter cache so plugin markers reflect the status change
              driver.notesAdapter?.fetchForEntry();
            }}
          />
          <NoteDropdownMenus noteFeedId={selectedNoteFeed.id} deletable={isSelectedFeedOwner} onDelete={deleteNote} />
        {/if}

        <Button variant="ghost" size="icon-sm" onclick={onSidebarClose}>
          <XIcon />
        </Button>
      </div>
    </section>

    <div class="flex flex-1 flex-col overflow-y-auto">
      {#key $refetches.noteFeeds.list}
        <!-- CONTENT::LIST VIEW -->
        {#if isListView}
          {#await loadNoteFeeds()}
            {#each Array.from({ length: 8 }) as _, i (i)}
              <NoteCardLoading />
            {/each}
          {:then noteFeeds}
            {@const visibleFeeds = isHidingOutdated ? noteFeeds.filter((nf) => !nf.isAnchorDeleted) : noteFeeds}
            {#each visibleFeeds as noteFeed (noteFeed.id)}
              <NoteFeedCard
                noteFeedRecord={noteFeed}
                showReplyCount
                resolvable
                onSelectNoteFeed={() => selectNoteFeed(noteFeed)}
              />
            {:else}
              <ResponseBlock
                title="No Notes"
                description="There are no notes yet. Be the first to add one!"
                icon={MessageCircleDashedIcon}
                class="mt-auto"
              ></ResponseBlock>
            {/each}
          {/await}
        {/if}
      {/key}

      {#key ($refetches.noteFeeds.list, $refetches.noteComments.list)}
        <!-- CONTENT::DETAIL VIEW -->
        {#if isDetailView && selectedNoteFeed}
          {#await loadNoteComments() then { noteFeed, noteComments }}
            {#if noteFeed}
              <NoteFeedCard
                highlighted={selectedNoteFeed.id === noteFeed.id}
                noteFeedRecord={noteFeed}
                onNoteFeedUpdated={(updatedFeed) => {
                  selectedNoteFeed = updatedFeed;
                }}
                onNoteFeedDeleted={backToNoteFeedList}
              />
            {/if}

            {#each noteComments as noteComment (noteComment.id)}
              <NoteCommentCard noteCommentRecord={noteComment} highlighted={selectedNoteCommentId === noteComment.id} />
            {/each}
          {/await}
        {/if}
      {/key}
    </div>

    <!-- FOOTER -->
    <section
      class="bg-background sticky bottom-0 mt-auto flex flex-col gap-4 border-t p-2 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.15)]"
    >
      <NoteForm
        showFeedbackField={isListView}
        feedbackValues={feedbackKeys}
        onFeedbackSelected={(selected) => (feedbackKeys = selected)}
        contentValue={contentMd}
        onContentChange={(newValue) => (contentMd = newValue)}
        contentLabel={isListView ? "Comment" : "Reply"}
        contentPlaceholder={isListView ? "Leave a comment here" : "Leave a reply here"}
        submitLabel={isListView ? "Add Note" : "Reply"}
        loading={isSubmitting}
        loadingLabel={isListView ? "Commenting..." : "Replying..."}
        disabled={!isAllowToCreateNewNote}
        onSubmit={createNote}
      />
    </section>
  </div>
{/if}
