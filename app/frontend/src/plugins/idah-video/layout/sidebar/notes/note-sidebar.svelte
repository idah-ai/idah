<script lang="ts">
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
  async function loadNotes() {
    return await context.notes.feeds.list({
      filters: { ...noteFeedFilters },
      pagination: {
        page: 1,
        itemsPerPage: 1000,
      },
      sort: ["-created_at"],
    });
  }

  async function loadNoteDetail() {
    const noteFeed = await context.notes.feeds.get($noteSidebarStore.selectedNoteFeed?.id!);
    const noteComments = await context.notes.comments.list({
      filters: {
        note_feed_id: $noteSidebarStore.selectedNoteFeed?.id,
      },
      sort: ["created_at"],
    });

    return { noteFeed, noteComments };
  }

  async function createNote() {
    if (isListView) {
      /** Create a general note feed, if current view is list */
      await context.notes.feeds.create({
        content_md: contentMd,
      });
      toast.success("Comment added from sidebar");
    }

    if (isDetailView && $noteSidebarStore.selectedNoteFeed) {
      /** Create a note comment under the selected note feed, if current view is detail */
      await context.notes.comments.create({
        note_feed_id: $noteSidebarStore.selectedNoteFeed.id,
        content_md: contentMd,
      });
      toast.success("Reply added to note");
    }

    contentMd = "";
    $noteSidebarStore.lastUpdated = new Date();
  }

  function backToNoteFeedList() {
    $noteSidebarStore.selectedNoteFeed = null;
    $noteSidebarStore.lastUpdated = new Date();
  }

  async function deleteNoteFeed() {
    await context.notes.feeds.delete($noteSidebarStore.selectedNoteFeed!.id);
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
                <NoteFeedCard {noteFeed}></NoteFeedCard>

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

            {#await loadNotes()}
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
