<script lang="ts">
  import {
    ArrowLeftIcon,
    FunnelIcon,
    MessageCircleDashedIcon,
    MessageCirclePlusIcon,
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

  import NoteBox from "./note-box.svelte";
  import NoteDropdownMenus from "./note-dropdown-menus.svelte";
  import NoteFeedCard from "./note-feed-card.svelte";
  import { closeNoteSidebar, noteSidebarStore } from "./note-sidebar-stores";
  import ResolveNoteButton from "./resolve-note-button.svelte";

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
          label: "Show Pending Notes",
          icon: noteFeedFilters.status__in.includes("pending") ? SquareCheckBigIcon : SquareIcon,
          disabled: noteFeedFilters.status__in.length === 1,
          action: () => {
            noteFeedFilters.status__in = ["pending"];
            $noteSidebarStore.lastUpdated = new Date();
          },
        },
        {
          label: "Show Resolved Notes",
          icon: noteFeedFilters.status__in.includes("resolved") ? SquareCheckBigIcon : SquareIcon,
          disabled: noteFeedFilters.status__in.includes("resolved"),
          action: () => {
            noteFeedFilters.status__in = ["pending", "resolved"];
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
    const noteComments = await context.notes.comments.list({
      filters: {
        note_feed_id: $noteSidebarStore.selectedNoteFeed?.id,
      },
      sort: ["created_at"],
    });

    return { noteComments };
  }

  async function createGeneralComment() {
    await context.notes.feeds.create({
      content_md: contentMd,
    });
    toast.success("Comment added from sidebar");
    $noteSidebarStore.lastUpdated = new Date();
  }

  function backToNoteFeedList() {
    $noteSidebarStore.selectedNoteFeed = null;
    $noteSidebarStore.lastUpdated = new Date();
  }
</script>

<Sidebar
  variant="floating"
  collapsible="offcanvas"
  side="right"
  class={cn("top-14 z-50 h-[calc(100vh-3.5rem)] w-96", $noteSidebarStore.open ? "" : "invisible")}
>
  <SidebarHeader class=" flex w-full flex-col items-center gap-0">
    <div class="flex w-full flex-row items-center gap-2">
      <!-- SHOW BACK BUTTON WHEN selectedNoteFeedId IS NOT NULL -->
      {#if isDetailView}
        <Button variant="ghost" size="icon" onclick={backToNoteFeedList}>
          <ArrowLeftIcon />
        </Button>
      {/if}

      <Text size="h4" weight="semibold" class="flex-1">
        {isListView ? "Notes" : "Note"}
      </Text>

      {#if isListView}
        <DropdownMenus menus={filterMenus} align="end">
          {#snippet trigger({ props })}
            <Button {...props} variant="ghost" size="icon">
              <FunnelIcon />
            </Button>
          {/snippet}
        </DropdownMenus>
      {/if}

      {#if isDetailView && $noteSidebarStore.selectedNoteFeed}
        <NoteDropdownMenus id={$noteSidebarStore.selectedNoteFeed.id} />
        <ResolveNoteButton noteFeed={$noteSidebarStore.selectedNoteFeed} />
      {/if}

      <Button variant="ghost" size="icon" onclick={closeNoteSidebar}>
        <XIcon />
      </Button>
    </div>
  </SidebarHeader>
  <SidebarSeparator />

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent class="flex flex-col gap-2">
        {#if $noteSidebarStore.selectedNoteFeed}
          <!-- NOTE FEED::DETAIL -->
          {#await loadNoteDetail() then { noteComments }}
            <NoteFeedCard noteFeed={$noteSidebarStore.selectedNoteFeed}></NoteFeedCard>

            {#each noteComments as noteComment (noteComment.id)}
              {noteComment.id}
            {/each}
          {/await}
        {:else}
          <!-- NOTE FEEDS::LISTS -->
          {#key $noteSidebarStore.lastUpdated}
            {#await loadNotes()}
              <Spinner />
            {:then notes}
              {#each notes as noteFeed (noteFeed.id)}
                <NoteFeedCard {noteFeed}></NoteFeedCard>
              {:else}
                <ResponseBlock
                  title="No Notes"
                  description="There are no notes yet. Be the first to add one!"
                  icon={MessageCircleDashedIcon}
                >
                  {#snippet actions()}
                    <Button>
                      <MessageCirclePlusIcon />
                      Add Note
                    </Button>
                  {/snippet}
                </ResponseBlock>
              {/each}
            {/await}
          {/key}
        {/if}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  <SidebarSeparator />
  <SidebarFooter>
    <SidebarGroup class="mt-auto">
      <NoteBox
        disabled={!isInReviewStep}
        value={contentMd}
        onInput={(e) => (contentMd = e.currentTarget.value)}
        onSubmit={createGeneralComment}
      ></NoteBox>
    </SidebarGroup>
  </SidebarFooter>
</Sidebar>
