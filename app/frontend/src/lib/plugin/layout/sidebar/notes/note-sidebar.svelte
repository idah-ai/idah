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
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { SvelteURL } from "svelte/reactivity";
  import { slide } from "svelte/transition";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Spinner } from "@/components/ui/spinner";
  import Text from "@/components/ui/text/Text.svelte";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/resolve-note-feed-button.svelte";
  import NoteCommentCard from "@/plugin/layout/sidebar/notes/cards/note-comment-card.svelte";
  import NoteFeedCard from "@/plugin/layout/sidebar/notes/cards/note-feed-card.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";
  import NoteInputField from "@/plugin/layout/sidebar/notes/inputs/note-input-field.svelte";

  import { noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { deleteNoteFeed } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    context: IActivityContext;
    open: boolean;
    onSidebarClose: () => void;
  }
  let { context, open, onSidebarClose }: Props = $props();

  // Variables
  let selectedNoteFeed: NoteFeedRecord | null = $state(null);
  let selectedNoteCommentId: string | null = $state(null);
  let isInReviewStep = $derived(context.workflowStep === "review");
  let isListView = $derived(!selectedNoteFeed);
  let isDetailView = $derived(!!selectedNoteFeed);
  let noteFeedFilters = $state<Hash>({ status__in: ["pending"] });
  let isFilteringResolved = $derived(noteFeedFilters.status__in.includes("resolved"));
  let contentMd = $state<string>("");

  const filterMenus: IDropdownMenus = $derived({
    filters: {
      items: [
        {
          label: "Show Resolved Notes",
          icon: noteFeedFilters.status__in.includes("resolved") ? SquareCheckBigIcon : SquareIcon,
          action: () => {
            noteFeedFilters.status__in = noteFeedFilters.status__in.includes("resolved")
              ? ["pending"]
              : ["pending", "resolved"];

            $refetches.noteFeeds.list = new Date();
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

        /**
         * Only go to detail view if note feed is general note
         */
        if (noteFeedRes.data.anchor_type === "entry" && !!noteFeedRes.data.annotation_id) {
          selectedNoteFeed = noteFeedRes.data;
          open = true;
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
      case "general": {
        selectedNoteFeed = noteFeed;
        break;
      }

      default: {
        context.notes.gotoFeed(noteFeed.id);
        break;
      }
    }
  }

  function backToNoteFeedList() {
    selectedNoteFeed = null;
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
        entry_id: context.id,
        ...noteFeedFilters,
      },
      pagination: {
        page: 1,
        itemsPerPage: 1000,
      },
      sort: ["-created_at"],
    });
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
    if (!contentMd.trim()) return;

    if (isListView) {
      /** Create a general note feed, if current view is list */
      await noteFeedsBackendDataSource.create({
        attributes: {
          entry_id: context.id,
          annotation_id: undefined,
          anchor_type: "entry",
          content_md: contentMd,
          created_by_email: "reviewer_user@example.com",
        },
      });
      toast.success("General note added successfully.");
      $refetches.noteFeeds.list = new Date();
    }

    if (isDetailView && selectedNoteFeed) {
      /** Create a note comment under the selected note feed, if current view is detail */
      await noteCommentsBackendDataSource.create({
        attributes: {
          note_feed_id: selectedNoteFeed.id,
          content_md: contentMd,
          created_by_email: "reply_user@example.com",
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
      toast.success("Reply added successfully.");
      $refetches.noteComments.list = new Date();
    }

    contentMd = "";
  }

  async function deleteNote() {
    if (!selectedNoteFeed) return;

    await deleteNoteFeed(selectedNoteFeed.id);
    backToNoteFeedList();
  }
</script>

{#if open}
  <div
    transition:slide={{ axis: "x" }}
    class="bg-background absolute right-0 top-12 z-50 ml-auto flex h-[calc(100%-3rem)] w-80 flex-col border-l"
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
                  <div class="bg-primary absolute right-1 top-1 size-2 animate-pulse rounded-full"></div>
                {/if}
              </Button>
            {/snippet}
          </DropdownMenus>
        {/if}

        {#if isDetailView && selectedNoteFeed}
          <ResolveNoteFeedButton
            noteFeed={selectedNoteFeed}
            onNoteResolved={(resolvedNoteFeed) => (selectedNoteFeed = resolvedNoteFeed)}
          />
          <NoteDropdownMenus noteFeedId={selectedNoteFeed.id} deletable onDelete={deleteNote} />
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
            <Spinner />
          {:then noteFeeds}
            {#each noteFeeds as noteFeed (noteFeed.id)}
              <NoteFeedCard
                noteFeedRecord={noteFeed}
                showReplyCount
                resolvable
                editable
                deletable
                onSelectNoteFeed={() => selectNoteFeed(noteFeed)}
              />
            {:else}
              <ResponseBlock
                title="No Notes"
                description="There are no notes yet. Be the first to add one!"
                icon={MessageCircleDashedIcon}
                class="mt-auto"
              >
                {#snippet actions()}{/snippet}
              </ResponseBlock>
            {/each}
          {/await}
        {/if}
      {/key}

      {#key ($refetches.noteFeeds.list, $refetches.noteComments.list)}
        <!-- CONTENT::DETAIL VIEW -->
        {#if isDetailView && selectedNoteFeed}
          {#await loadNoteComments() then { noteFeed, noteComments }}
            {#if noteFeed}
              <NoteFeedCard noteFeedRecord={noteFeed} editable />
            {/if}

            {#each noteComments as noteComment (noteComment.id)}
              <NoteCommentCard noteCommentRecord={noteComment} highlighted={selectedNoteCommentId === noteComment.id} />
            {/each}
          {/await}
        {/if}
      {/key}
    </div>

    <!-- FOOTER -->
    <section class="bg-background sticky bottom-0 mt-auto flex border-t p-2">
      <NoteInputField
        disabled={!isInReviewStep}
        placeholder={isListView ? "Write your note" : "Reply"}
        value={contentMd}
        onInput={(e) => (contentMd = e.currentTarget.value)}
        onSubmit={createNote}
      ></NoteInputField>
    </section>
  </div>
{/if}
