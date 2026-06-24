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
  import { cn } from "@/utils";

  // Inlined entry modals + actions (mirrors entry-dropdown-menu.svelte)
  import UploadEntryButton from "@/components/app/datasets/entries/button/_UploadEntryButton.svelte";
  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/_AssignEntryFormModal.svelte";
  import UpdateEntryPriorityFormModal from "@/components/app/datasets/entries/overlays/_UpdateEntryPriorityFormModal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import { deleteEntries, exportEntries, unAssignEntries } from "@/components/app/datasets/entries/util/entry-actions";
  import { pluralizeUnit } from "@/utils/unit";

  import { ArrowDownAZIcon, ArrowDownZAIcon, ArrowUpDownIcon, ChevronsUpDownIcon, FunnelIcon } from "@lucide/svelte";

  import type { ListViewController } from "@/components/app/data-view/list-view-controller.svelte";
  import type { ColumnSettings } from "@/components/app/datasource-table/types";
  import type { EntrySelection } from "@/components/app/datasets/entries/util/entry-selection.svelte";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  let {
    controller,
    sel,
    canUpdateEntry,
    canDeleteEntry,
    projectId,
    datasetId,
  }: {
    controller: ListViewController<EntryRecord>;
    sel: EntrySelection;
    canUpdateEntry: boolean;
    canDeleteEntry: boolean;
    projectId: string;
    datasetId: string;
  } = $props();

  // Modal visibility - owned here
  let openAssignEntry = $state(false);
  let openSetPriority = $state(false);
  let openConfirmUnassign = $state(false);
  let openConfirmDelete = $state(false);
  let openExport = $state(false);

  const bulkActions = $derived(
    getEntryDropdownMenuActions({
      onAssign: () => {
        openAssignEntry = true;
      },
      onUnassign: () => {
        openConfirmUnassign = true;
      },
      onSetPriority: () => {
        openSetPriority = true;
      },
      onDelete: () => {
        openConfirmDelete = true;
      },
      isAssigned: sel.checkAnyAssigned(controller.selectedIds),
      isAssignDisabled: sel.assignableEntryIds.length === 0,
      isUnassignDisabled: sel.unAssignableEntryIds.length === 0,
    }),
  );

  async function handleUnassign(): Promise<void> {
    const updated = await unAssignEntries(sel.unAssignableEntryIds, (id) => sel.getEntryName(id));
    if (updated) {
      controller.patchRecords(updated);
      controller.clearSelection();
      openConfirmUnassign = false;
      // Refetch so server-authoritative state is reflected (e.g. wf_step changes)
      await controller.fetch();
    }
  }

  async function handleDelete(): Promise<void> {
    const ok = await deleteEntries(controller.selectedIds, (id) => sel.getEntryName(id));
    if (ok) {
      controller.clearSelection();
      openConfirmDelete = false;
      await controller.fetch();
    }
  }

  async function handleExport(): Promise<void> {
    await exportEntries(datasetId, controller.selectedIds);
    controller.clearSelection();
    openExport = false;
  }
</script>

<div class="flex w-full gap-4">
  <div class="flex w-full flex-col items-center justify-between gap-4 lg:flex-row">
    <div class="flex flex-1 items-center gap-4">
      <!-- SELECT ALL -->
      {#if canUpdateEntry || canDeleteEntry}
        <div class="pl-6">
          <Checkbox
            checked={controller.selectedIds.length > 0 &&
              controller.selectedIds.length === controller.response.data.length}
            indeterminate={controller.selectedIds.length > 0 &&
              controller.selectedIds.length < controller.response.data.length}
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
            onFilter={controller.applyFilter.bind(controller)}
            onSort={controller.applySort.bind(controller)}
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

      <!-- ADD ENTRY (self-guards permission + owns its modal) -->
      <UploadEntryButton class="w-full lg:w-auto" />
    </div>
  </div>
</div>

<!-- BULK-ACTION MODALS (triggered from the dropdown above) -->
<AssignEntryFormModal
  action="update"
  entryIds={sel.assignableEntryIds}
  onAssigned={async () => {
    controller.clearSelection();
    await controller.fetch();
  }}
  entryRecord={sel.assignableEntryIds.length === 1 ? sel.entryMap.get(sel.assignableEntryIds[0]) : undefined}
  bind:open={openAssignEntry}
/>

<UpdateEntryPriorityFormModal action="update" entryIds={controller.selectedIds} bind:open={openSetPriority} />

<ConfirmModal
  title="Unassign entry"
  description={`Are you sure you want to unassign ${sel.unAssignableEntryIds.length} ${pluralizeUnit(sel.unAssignableEntryIds.length, "entry", "entries")}?`}
  onConfirm={handleUnassign}
  bind:open={openConfirmUnassign}
/>

<ConfirmModal
  title="Delete entry"
  description={`Are you sure you want to delete ${controller.selectedRowsCount} ${pluralizeUnit(controller.selectedRowsCount, "entry", "entries")}? This action cannot be undone.`}
  onConfirm={handleDelete}
  bind:open={openConfirmDelete}
/>

<!-- Export: handler/modal preserved but currently untriggered (no bulk-action wires it), same as today -->
<ConfirmModal
  title="Export {controller.selectedRowsCount} {pluralizeUnit(controller.selectedRowsCount, 'entry', 'entries')}"
  description="Are you sure you want to export {controller.selectedRowsCount} {pluralizeUnit(
    controller.selectedRowsCount,
    'entry',
    'entries',
  )}?"
  onConfirm={handleExport}
  bind:open={openExport}
/>
