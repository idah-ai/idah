<script lang="ts">
  import { MessageCircleDashedIcon, MessageCirclePlusIcon, SendHorizontalIcon, XIcon } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
  import { Button } from "@/components/ui/button";
  import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarSeparator,
  } from "@/components/ui/sidebar";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  import NoteFeedCard from "./note-feed-card.svelte";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";
  import type { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
  import type { INoteFeed } from "@/plugin/interface/Activity";

  // Props
  interface Props extends ComponentProps<typeof Sidebar> {
    showCommentsSidebar: boolean;
    onCommentsSidebarToggle: () => void;
  }
  let { showCommentsSidebar, onCommentsSidebarToggle }: Props = $props();

  // Variables
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
  const mockNotes: INoteFeed[] = [
    {
      id: "1",
      entry_id: "0199c777-d0a1-7744-aa7e-404ff6aa3c63",
      annotation_id: null,
      created_by_id: 1,
      anchor_type: "entry",
      position: {},
      content_md: "This is a sample comment for the video entry.",
      status: "open",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-10-01T10:00:00Z",
    },
    {
      id: "2",
      entry_id: "0199c777-d0a1-7744-aa7e-404ff6aa3c63",
      annotation_id: null,
      created_by_id: 1,
      anchor_type: "entry",
      position: {},
      content_md: "This is a sample comment for the video entry.",
      status: "open",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-10-01T10:00:00Z",
    },
    {
      id: "3",
      entry_id: "0199c777-d0a1-7744-aa7e-404ff6aa3c63",
      annotation_id: null,
      created_by_id: 1,
      anchor_type: "entry",
      position: {},
      content_md: "This is a sample comment for the video entry.",
      status: "open",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-10-01T10:00:00Z",
    },
    {
      id: "4",
      entry_id: "0199c777-d0a1-7744-aa7e-404ff6aa3c63",
      annotation_id: null,
      created_by_id: 1,
      anchor_type: "entry",
      position: {},
      content_md: "This is a sample comment for the video entry.",
      status: "open",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-10-01T10:00:00Z",
    },
    {
      id: "5",
      entry_id: "0199c777-d0a1-7744-aa7e-404ff6aa3c63",
      annotation_id: null,
      created_by_id: 1,
      anchor_type: "entry",
      position: {},
      content_md: "This is a sample comment for the video entry.",
      status: "open",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-10-01T10:00:00Z",
    },
  ];
</script>

<Sidebar
  variant="floating"
  collapsible="offcanvas"
  side="right"
  class={cn("top-14 z-50 h-[calc(100vh-3.5rem)] w-80", showCommentsSidebar ? "" : "invisible")}
>
  <SidebarHeader class="flex w-full flex-col items-center gap-0">
    <div class="flex w-full flex-row items-center gap-2">
      <Text size="h4" weight="semibold" class="flex-1">Comments</Text>

      <Button variant="ghost" size="icon" onclick={onCommentsSidebarToggle}>
        <XIcon />
      </Button>
    </div>

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
  </SidebarHeader>
  <SidebarSeparator />

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent class="flex flex-col gap-2">
        {#each mockNotes as noteFeed (noteFeed.id)}
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

  <SidebarSeparator />
  <SidebarFooter>
    <SidebarGroup class="mt-auto">
      <InputGroup>
        <InputGroupTextarea placeholder="Enter your comment" />
        <InputGroupAddon align="block-end">
          <InputGroupButton aria-label="Send" class="ml-auto rounded-full" variant="default" size="icon-xs">
            <SendHorizontalIcon class="size-3" />
            <span class="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </SidebarGroup>
  </SidebarFooter>
</Sidebar>
