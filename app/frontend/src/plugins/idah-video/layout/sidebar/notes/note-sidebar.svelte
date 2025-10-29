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
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarSeparator,
  } from "@/components/ui/sidebar";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { cn } from "@/utils";

  import ResolveNoteButton from "./buttons/resolve-note-button.svelte";
  import NoteCommentCard from "./cards/note-comment-card.svelte";
  import NoteFeedCard from "./cards/note-feed-card.svelte";
  import NoteDropdownMenus from "./dropdown-menus/note-dropdown-menus.svelte";
  import NoteBox from "./note-box.svelte";
  import { closeNoteSidebar, noteSidebarStore } from "./note-sidebar-stores";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { Hash } from "@/utils/types";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let entryId = $derived(page.params.entryId) as string;
  let isInReviewStep = $derived(context.workflowStep === "review");
  let isListView = $derived(!$noteSidebarStore.selectedNoteFeed);
  let isDetailView = $derived(!!$noteSidebarStore.selectedNoteFeed);
  let noteFeedFilters = $state<Hash>({ status__in: ["pending"] });
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

            $noteSidebarStore.lastUpdated = new Date();
          },
        },
      ],
    },
  });

  // Functions
  async function loadNoteFeeds() {
    const noteFeedsRes = await noteFeedsBackendDataSource.list({
      filters: { entry_id: entryId, ...noteFeedFilters },
      pagination: {
        page: 1,
        itemsPerPage: 1000,
      },
      sort: ["-created_at"],
    });
    return noteFeedsRes.data;
  }

  async function loadNoteDetail() {
    const noteFeedRes = await noteFeedsBackendDataSource.get($noteSidebarStore.selectedNoteFeed?.id!);
    const noteCommentsRes = await noteCommentsBackendDataSource.list({
      filters: {
        note_feed_id: $noteSidebarStore.selectedNoteFeed?.id,
      },
      sort: ["created_at"],
    });

    return { noteFeed: noteFeedRes.data, noteComments: noteCommentsRes.data };
  }

  async function createNote() {
    if (isListView) {
      /** Create a general note feed, if current view is list */
      await noteFeedsBackendDataSource.create({
        attributes: {
          entry_id: entryId,
          annotation_id: undefined,
          anchor_type: "entry",
          content_md: contentMd,
        },
      });
      toast.success("Comment added from sidebar");
    }

    if (isDetailView && $noteSidebarStore.selectedNoteFeed) {
      /** Create a note comment under the selected note feed, if current view is detail */
      await noteCommentsBackendDataSource.create({
        attributes: {
          note_feed_id: $noteSidebarStore.selectedNoteFeed.id,
          content_md: contentMd,
        },
        relationships: {
          note_feed: {
            data: {
              id: $noteSidebarStore.selectedNoteFeed.id,
              type: "dataset:note_feeds",
            },
          },
        },
      });
      toast.success("Reply added to note");
    }

    contentMd = "";
    $noteSidebarStore.lastUpdated = new Date();
  }

  function backToNoteFeedList() {
    $noteSidebarStore.selectedNoteFeed = null;
    $noteSidebarStore.lastUpdated = new Date();

    // Remove hash from url
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  }

  async function deleteNoteFeed() {
    const noteCommentsRes = await noteCommentsBackendDataSource.list({
      fields: {
        [NoteCommentRecord.type]: ["id"],
      },
      filters: {
        note_feed_id: $noteSidebarStore.selectedNoteFeed!.id,
      },
    });

    noteCommentsRes.data.forEach(async (noteComment) => {
      await noteCommentsBackendDataSource.delete(noteComment.id);
    });

    await noteFeedsBackendDataSource.delete($noteSidebarStore.selectedNoteFeed!.id);

    $noteSidebarStore.selectedNoteFeed = null;
    $noteSidebarStore.lastUpdated = new Date();
  }
</script>

<Sidebar
  variant="sidebar"
  collapsible="offcanvas"
  side="right"
  class={cn("top-[2.75rem] z-30 h-[calc(100vh-2.75rem)] w-80", $noteSidebarStore.open ? "" : "invisible")}
>
  <SidebarHeader class=" flex w-full flex-col items-center gap-0">
    <div class="flex w-full flex-row items-center">
      <!-- SHOW BACK BUTTON WHEN selectedNoteFeedId IS NOT NULL -->
      {#if isDetailView}
        <Button variant="ghost" size="icon-sm" onclick={backToNoteFeedList}>
          <ArrowLeftIcon />
        </Button>
      {/if}

      <Text weight="semibold" class="flex-1">
        {isListView ? "Notes" : "Note"}
      </Text>

      {#if isListView}
        <DropdownMenus menus={filterMenus} align="end">
          {#snippet trigger({ props })}
            <Button {...props} variant="ghost" size="icon-sm">
              <FunnelIcon />
            </Button>
          {/snippet}
        </DropdownMenus>
      {/if}

      {#if isDetailView && $noteSidebarStore.selectedNoteFeed}
        <ResolveNoteButton noteFeed={$noteSidebarStore.selectedNoteFeed} />
        <NoteDropdownMenus
          noteFeedId={$noteSidebarStore.selectedNoteFeed.id}
          editable={false}
          onDelete={deleteNoteFeed}
        />
      {/if}

      <Button variant="ghost" size="icon-sm" onclick={closeNoteSidebar}>
        <XIcon />
      </Button>
    </div>
  </SidebarHeader>
  <SidebarSeparator />

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent class="flex flex-col gap-2">
        {#key $noteSidebarStore.lastUpdated}
          {#if $noteSidebarStore.selectedNoteFeed}
            <!-- NOTE FEED::DETAIL -->
            {#key $noteSidebarStore.lastUpdated}
              {#await loadNoteDetail() then { noteFeed, noteComments }}
                <NoteFeedCard {noteFeed} deletable={false}></NoteFeedCard>

                {#each noteComments as noteComment (noteComment.id)}
                  <NoteCommentCard
                    {noteComment}
                    highlighted={$noteSidebarStore.selectedNoteCommentId === noteComment.id}
                  ></NoteCommentCard>
                {/each}
              {/await}
            {/key}
          {:else}
            <!-- NOTE FEEDS::LISTS -->

            {#await loadNoteFeeds()}
              <Spinner />
            {:then notes}
              {#each notes as noteFeed (noteFeed.id)}
                <NoteFeedCard {noteFeed} highlighted={noteFeed.id === $noteSidebarStore.noteFeedPopup.noteFeed?.id}
                ></NoteFeedCard>
              {:else}
                <ResponseBlock
                  title="No Notes"
                  description="There are no notes yet. Be the first to add one!"
                  icon={MessageCircleDashedIcon}
                >
                  {#snippet actions()}{/snippet}
                </ResponseBlock>
              {/each}
            {/await}
          {/if}
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  <SidebarSeparator />
  <SidebarFooter>
    <SidebarGroup class="mt-auto">
      <NoteBox
        disabled={!isInReviewStep}
        placeholder={isListView ? "Write your note" : "Reply"}
        value={contentMd}
        onInput={(e) => (contentMd = e.currentTarget.value)}
        onSubmit={createNote}
      ></NoteBox>
    </SidebarGroup>
  </SidebarFooter>
</Sidebar>
