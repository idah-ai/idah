<script lang="ts">
  import { entryColumns } from "@/components/app/datasets/entries/data-tables/entry-columns";
  import { getEntryDropdownMenuActions } from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Can from "@/security/can.svelte";
  import { cn } from "@/utils";

  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    ChevronsUpDownIcon,
    FunnelIcon,
    PlusIcon,
  } from "@lucide/svelte";

  import type { EntriesListController } from "@/components/app/datasets/entries/overlays/entries-list.svelte";
  import type { ColumnSettings } from "@/components/app/datasource-table/types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import type { ProjectMemberScope } from "@/security/types";

  let {
    controller,
    canUpdateEntry,
    canDeleteEntry,
    projectId,
    as_project_owner,
    onOpenNewEntry,
    onOpenAssign,
    onOpenUnassign,
    onOpenSetPriority,
    onOpenDelete,
  }: {
    controller: EntriesListController;
    canUpdateEntry: boolean;
    canDeleteEntry: boolean;
    projectId: string;
    as_project_owner: { as_user: ProjectMemberScope };
    onOpenNewEntry: () => void;
    onOpenAssign: () => void;
    onOpenUnassign: () => void;
    onOpenSetPriority: () => void;
    onOpenDelete: () => void;
  } = $props();

  const bulkActions = $derived(
    getEntryDropdownMenuActions({
      onAssign: onOpenAssign,
      onUnassign: onOpenUnassign,
      onSetPriority: onOpenSetPriority,
      onDelete: onOpenDelete,
      isAssigned: controller.checkAnyAssigned(controller.selectedEntryIds),
      isAssignDisabled: controller.assignableEntryIds.length === 0,
      isUnassignDisabled: controller.unAssignableEntryIds.length === 0,
    }),
  );
</script>

<div class="flex w-full gap-4">
  <div class="flex w-full flex-col items-center justify-between gap-4 lg:flex-row">
    <div class="flex flex-1 items-center gap-4">
      <!-- SELECT ALL -->
      {#if canUpdateEntry || canDeleteEntry}
        <div class="pl-6">
          <Checkbox
            checked={controller.selectedEntryIds.length > 0 &&
              controller.selectedEntryIds.length === controller.response.data.length}
            indeterminate={controller.selectedEntryIds.length > 0 &&
              controller.selectedEntryIds.length < controller.response.data.length}
            onCheckedChange={controller.toggleSelectAll.bind(controller)}
          />
        </div>
      {/if}

      <!-- COLUMN FILTER / SORT BUTTONS -->
      <div class="flex flex-wrap gap-2">
        {#each Object.entries(entryColumns) as [columnKey, columnSetting] (columnKey)}
          <FilterSortDropdownMenu
            contexts={{ projectId }}
            {columnKey}
            columnSetting={columnSetting as ColumnSettings<EntryRecord>}
            filters={controller.listOptions.filters || {}}
            sort={controller.listOptions.sort || []}
            onFilter={controller.filterEntries.bind(controller)}
            onSort={controller.sortEntries.bind(controller)}
            onHide={() => {}}
          >
            {#snippet trigger({ label, sortable, isSorting, isSortingAsc, isSortingDesc, filterable, isFiltering })}
              <Button
                variant={isFiltering || isSorting ? "default" : "outline"}
                class={cn(
                  "data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground my-2 w-full min-w-40 gap-2 font-normal",
                  isFiltering || isSorting ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {#if isFiltering}
                  <FunnelIcon class="size-4" />
                {/if}

                <span class="mr-auto">{label}</span>

                {#if sortable || filterable}
                  {#if isSortingAsc}
                    <ArrowDownAZIcon class="size-4" />
                  {:else if isSortingDesc}
                    <ArrowDownZAIcon class="size-4" />
                  {:else}
                    <ArrowUpDownIcon class="size-4" />
                  {/if}
                {/if}
              </Button>
            {/snippet}
          </FilterSortDropdownMenu>
        {/each}
      </div>
    </div>

    <div class={cn("w-full gap-2 lg:w-auto", controller.isRowSelected ? "grid grid-cols-2" : "flex justify-end")}>
      <!-- BULK ACTIONS -->
      {#if controller.isRowSelected}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" class="bg-primary/10 hover:bg-primary/20 w-full transition-opacity">
              {controller.selectedRowsCount} selected
              <ChevronsUpDownIcon class="text-muted-foreground ml-2 size-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuGroup>
              {#each bulkActions as { label, icon: Icon, action, disabled, hidden }, index (index)}
                {#if !hidden}
                  <DropdownMenuItem {disabled} onclick={action}>
                    <Icon class="mr-2 size-4" />
                    {label}
                  </DropdownMenuItem>
                {/if}
              {/each}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      {/if}

      <!-- ADD ENTRY -->
      <Can action="create" resource="dataset:entries" scopes={["as_org_owner", as_project_owner]}>
        <Button onclick={onOpenNewEntry} class="w-full lg:w-auto">
          <PlusIcon />
          Add Entry
        </Button>
      </Can>
    </div>
  </div>
</div>
