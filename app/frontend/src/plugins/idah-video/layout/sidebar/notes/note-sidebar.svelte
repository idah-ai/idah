<script lang="ts">
  import { ArrowLeftIcon, FunnelIcon, MessageCircleDashedIcon, MessageCirclePlusIcon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
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

  import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
  import { cn } from "@/utils";

  import NoteBox from "./note-box.svelte";
  import NoteFeedCard from "./note-feed-card.svelte";
  import { closeNoteSidebar, noteSidebarStore } from "./note-sidebar-stores";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";
  import type { IActivityContext, INoteComment } from "@/plugin/interface/Activity";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let isInReviewStep = $derived(context.workflowStep === "review");
  let isListView = $derived(!$noteSidebarStore.selectedNoteFeed);
  let isDetailView = $derived(!!$noteSidebarStore.selectedNoteFeed);
  let contentMd = $state<string>("");

  const filterSortOptions: ColumnsSettings<NoteFeedRecord> = {
    status: {
      label: "Status",
      dataType: "enum",
      sortable: true,
      filterable: true,
      visible: true,
      hidable: false,
    },
    created_by_id: {
      label: "Commentor",
      dataType: "number",
      sortable: true,
      filterable: true,
      visible: true,
      hidable: false,
    },
  };

  // Functions
  async function loadNotes() {
    return await context.notes.feeds.list({
      pagination: {
        page: 1,
        itemsPerPage: 1000,
      },
      sort: ["-created_at"],
    });
  }

  async function loadNoteDetail() {
    const noteComments: Array<INoteComment> = [];
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

      <Button
        variant={$noteSidebarStore.showFilters ? "default" : "ghost"}
        size="icon"
        onclick={() => ($noteSidebarStore.showFilters = !$noteSidebarStore.showFilters)}
      >
        <FunnelIcon />
      </Button>

      <Button variant="ghost" size="icon" onclick={closeNoteSidebar}>
        <XIcon />
      </Button>
    </div>

    {#if $noteSidebarStore.showFilters}
      <div class="grid w-full grid-cols-2 gap-2">
        {#each Object.entries(filterSortOptions) as [columnKey, columnSetting] (columnKey)}
          <FilterSortDropdownMenu
            {columnKey}
            {columnSetting}
            filters={{}}
            sort={["-created_at"]}
            onFilter={async () => {}}
            onSort={async () => {}}
            onHide={() => {}}
          />
        {/each}
      </div>
    {/if}
  </SidebarHeader>
  <SidebarSeparator />

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent class="flex flex-col gap-2">
        {#if $noteSidebarStore.selectedNoteFeed}
          <!-- NOTE FEED::DETAIL -->
          {#await loadNoteDetail() then { noteComments }}
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
