<script lang="ts">
  import { FunnelIcon, MessageCircleDashedIcon, MessageCirclePlusIcon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
  import { Button } from "@/components/ui/button";

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

  import CommentsBox from "./comments-box.svelte";
  import { closeCommentsSidebar, commentsSidebarStore } from "./comments-sidebar-stores";
  import NoteFeedCard from "./note-feed-card.svelte";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let isInReviewStep = $derived(context.workflowStep === "review");
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
    return await context.notes.list({
      pagination: {
        page: 1,
        itemsPerPage: 20,
      },
      sort: ["-created_at"],
    });
  }

  async function createGeneralComment() {
    await context.notes.create({
      content_md: contentMd,
    });
    toast.success("Comment added from sidebar");
    $commentsSidebarStore.lastUpdated = new Date();
  }
</script>

<Sidebar
  variant="floating"
  collapsible="offcanvas"
  side="right"
  class={cn("top-14 z-50 h-[calc(100vh-3.5rem)] w-80", $commentsSidebarStore.open ? "" : "invisible")}
>
  <SidebarHeader class="flex w-full flex-col items-center gap-0">
    <div class="flex w-full flex-row items-center gap-2">
      <Text size="h4" weight="semibold" class="flex-1">Comments</Text>

      <Button
        variant={$commentsSidebarStore.showFilters ? "default" : "ghost"}
        size="icon"
        onclick={() => ($commentsSidebarStore.showFilters = !$commentsSidebarStore.showFilters)}
      >
        <FunnelIcon />
      </Button>

      <Button variant="ghost" size="icon" onclick={closeCommentsSidebar}>
        <XIcon />
      </Button>
    </div>

    {#if $commentsSidebarStore.showFilters}
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

  {#key $commentsSidebarStore.lastUpdated}
    {#await loadNotes()}
      <Spinner />
    {:then notes}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent class="flex flex-col gap-2">
            {#each notes as noteFeed (noteFeed.id)}
              <NoteFeedCard {noteFeed}></NoteFeedCard>
            {:else}
              <ResponseBlock
                title="No Comments"
                description="There are no issues yet. Be the first to add one!"
                icon={MessageCircleDashedIcon}
              >
                {#snippet actions()}
                  <Button>
                    <MessageCirclePlusIcon />
                    Add Issue
                  </Button>
                {/snippet}
              </ResponseBlock>
            {/each}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    {/await}
  {/key}

  <SidebarSeparator />
  <SidebarFooter>
    <SidebarGroup class="mt-auto">
      <CommentsBox
        disabled={!isInReviewStep}
        value={contentMd}
        onInput={(e) => (contentMd = e.currentTarget.value)}
        onSubmit={createGeneralComment}
      ></CommentsBox>
    </SidebarGroup>
  </SidebarFooter>
</Sidebar>
