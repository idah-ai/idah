<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onMount } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import EntryCard from "@/components/app/datasets/entries/cards/entry-card.svelte";
  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/assign-entry-form-modal.svelte";
  import CreateEntryFormModal from "@/components/app/datasets/entries/overlays/create-entry-form-modal.svelte";
  import UpdateEntryPriorityFormModal from "@/components/app/datasets/entries/overlays/update-entry-priority-form-modal.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Can from "@/security/can.svelte";

  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    ChevronsUpDownIcon,
    FunnelIcon,
    LayoutListIcon,
    PlusIcon,
  } from "@lucide/svelte";

  import { entryColumns } from "@/components/app/datasets/entries/data-tables/entry-columns";
  import { getEntryDropdownMenuActions } from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { cn } from "@/utils";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
  } from "@/components/app/datasource-table/types";
  import type { ListOptions } from "@/data/DataSource";
  import type { CollectionResponse } from "@/data/model/types";
  import type { ProjectMemberScope } from "@/security/types";
  import type { Hash } from "@/utils/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Records
  let response: CollectionResponse<EntryRecord> = $state({
    data: [],
    meta: {},
  });

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;

  // Optional URL Params
  let urlFiltersHash = $derived(Object.fromEntries(page.url.searchParams.entries()));
  let urlFilters: Hash<string> = $derived.by(() => {
    /**
     * Regex to extract column key and operator from URL filter
     *
     * Example:
     * - key: "filters[name__match]"
     * - value: "John"
     * - match: ["filters[name__match]", "filters", "name__match"]
     * - listOptionsKey: "filters" (can be: filters, included, pagination, fields, sort, all, noCache, count)
     * - columnKeyWithOperator: "name__match"
     */
    const urlFilterRegex: RegExp = /^([^[]+)\[([^\]]+)\]$/;
    const out: Hash<string> = {};

    Object.entries(urlFiltersHash).forEach(([key, value]) => {
      const match = key.match(urlFilterRegex);
      if (match) {
        const [, _listOptionsKey, columnKeyWithOperator] = match;
        out[columnKeyWithOperator] = value;
      }
    });

    return out;
  });

  let filters: Hash = $derived({
    dataset_id: datasetId,
    ...urlFilters,
  });

  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);
  let currentPage: number = $state(1);
  let itemsPerPage: number = $state(10);
  let selectedEntryIds: string[] = $state([]);
  let selectedRowsCount: number = $derived(selectedEntryIds.length);
  let selectedToUnassignedEntryIdsCount: number = $derived(
    response.data.filter((entry) => selectedEntryIds.includes(entry.id) && entry.assigned_to?.id).length,
  );
  let openNewEntryModal: boolean = $state(false);
  let openAssignEntryFormModal: boolean = $state(false);
  let openSetPriorityModal: boolean = $state(false);
  let openConfirmUnassignEntriesModal: boolean = $state(false);
  let openConfirmDeleteEntriesModal: boolean = $state(false);
  let openExportModal: boolean = $state(false);

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    canUpdateEntry =
      (await currentAccount?.can("update", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
    canDeleteEntry =
      (await currentAccount?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
  });

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/entries`) },
    { label: "Entries" },
  ]);

  let listOptions: ListOptions = $derived({
    filters: filters,
    included: ["assigned_to", "submitted_by", "reviewed_by"],
    fields: { [ProjectMemberRecord.type]: ["name", "email", "picture_url"] },
    sort: ["priority", "-created_at"],
    count: true,
    pagination: {
      page: currentPage,
      itemsPerPage,
    },
  });
  let isFiltering: boolean = $derived(
    Object.keys(listOptions.filters || {}).filter((key) => key !== "dataset_id").length > 0,
  );
  let isRowSelected: boolean = $derived(selectedRowsCount > 0);

  const bulkActions = $derived(
    getEntryDropdownMenuActions({
      onAssign: () => {
        openAssignEntryFormModal = true;
      },
      onUnassign: () => {
        openConfirmUnassignEntriesModal = true;
      },
      onSetPriority: () => {
        openSetPriorityModal = true;
      },
      onDelete: () => {
        openConfirmDeleteEntriesModal = true;
      },
      isAssigned: checkEntriesAssignedToAnyone(selectedEntryIds),
    }),
  );

  // Functions
  function checkEntriesAssignedToAnyone(entryIds: string[]): boolean {
    return response.data.some((entry) => entryIds.includes(entry.id) && !!entry.assigned_to_id);
  }

  function openNewEntryFormModal(): void {
    openNewEntryModal = true;
  }

  async function fetchEntries(): Promise<void> {
    response = await entriesBackendDataSource.list(listOptions);
  }

  function resetToFirstPage(): void {
    currentPage = 1;
  }

  async function filterEntries(params: FilterDataSourceParams): Promise<void> {
    const newUrl = new URL(page.url);

    let updatedFilters = { ...listOptions.filters };

    for (const [key, value] of Object.entries(params.filters)) {
      if (value === undefined) {
        /** Remove filter */
        delete updatedFilters[key];

        /** Manage filters[key] from URL if exists */
        if (key in urlFilters) {
          /** 1. Remove filters[key] from URL */
          newUrl.searchParams.delete(`filters[${key}]`);
          /** 2. Update URL */
          /* eslint-disable svelte/no-navigation-without-resolve */
          goto(newUrl.href, { replaceState: true });
          /* eslint-enable svelte/no-navigation-without-resolve */
        }
      } else {
        updatedFilters[key] = value;
      }

      urlFilters = Object.fromEntries(newUrl.searchParams.entries());
    }

    filters = updatedFilters;

    /** Add or update filter */
    listOptions = {
      ...listOptions,
      filters: {
        ...filters,
      },
    };

    resetToFirstPage();

    await fetchEntries();
  }

  async function sortEntries(params: SortDataSourceParams): Promise<void> {
    const { columnKey, sortDirection } = params;
    const sortPrefix: string = sortDirection === "desc" ? "-" : "";
    const sortKey: string = `${sortPrefix}${columnKey}`;

    if (sortDirection === "none") {
      /** Remove all sortKey from listOptions */
      listOptions = {
        ...listOptions,
        sort: listOptions.sort?.filter((currentSorting) => !currentSorting.endsWith(sortKey)),
      };
    } else {
      /** Add or update sortKey to listOptions */
      if (listOptions.sort?.some((currentSorting) => currentSorting.endsWith(columnKey))) {
        listOptions = {
          ...listOptions,
          sort: listOptions.sort?.map((currentSorting) =>
            currentSorting.endsWith(columnKey) ? sortKey : currentSorting,
          ),
        };
      } else {
        listOptions = {
          ...listOptions,
          sort: [...(listOptions.sort || []), sortKey],
        };
      }
    }

    resetToFirstPage();

    await fetchEntries();
  }

  async function changePage(changeToPage: number): Promise<void> {
    currentPage = changeToPage;

    await fetchEntries();
  }

  async function setItemsPerPage(selectedItemsPerPage: number): Promise<void> {
    resetToFirstPage();
    itemsPerPage = selectedItemsPerPage;

    await fetchEntries();
  }

  function selectRow(selectedId: string): void {
    if (selectedEntryIds.includes(selectedId)) {
      selectedEntryIds = selectedEntryIds.filter((id) => id !== selectedId);
    } else {
      selectedEntryIds = [...selectedEntryIds, selectedId];
    }
  }

  async function unAssignEntries(): Promise<void> {
    try {
      for (const entryId of selectedEntryIds) {
        await entriesBackendDataSource.update(entryId, {
          attributes: {
            assigned_to_id: null,
          },
        });
      }

      const selectedToUnassignedRows = response.data.filter(
        (entry) => selectedEntryIds.includes(entry.id) && entry.assigned_to_id,
      );
      const description =
        selectedToUnassignedEntryIdsCount > 1
          ? `${selectedToUnassignedRows.length} entries have been unassigned.`
          : `The entry "${selectedToUnassignedRows[0]?.name}" has been unassigned.`;

      showToast.success({
        title: "Entry unassigned",
        description,
      });

      selectedEntryIds = [];
      $refetches.entries.list = new Date();
      openConfirmUnassignEntriesModal = false;
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function deleteEntries(): Promise<void> {
    try {
      for (const entryId of selectedEntryIds) {
        await entriesBackendDataSource.delete(entryId, {
          showErrorToast: false,
        });
      }

      const description =
        selectedRowsCount > 1
          ? `${selectedRowsCount} entries have been deleted.`
          : `The entry "${response.data.find((entry) => entry.id === selectedEntryIds[0])?.resource}" has been deleted.`;

      showToast.success({
        title: "Entry deleted",
        description,
      });

      selectedEntryIds = [];
      $refetches.entries.list = new Date();
      openConfirmDeleteEntriesModal = false;
    } catch (error) {
      showToast.error({
        title: "Unable to delete entry",
        description: error?.errors[0]?.detail || "The action could not be completed, please try again later.",
      });
    }
  }

  async function exportEntries(): Promise<void> {
    await ExportsBackendDataSource.export({
      datasets: { id: datasetId },
      entries: { id__in: selectedEntryIds },
    });
    selectedEntryIds = [];
    openExportModal = false;
  }

  function toggleSelectAll(checked: boolean): void {
    if (checked) {
      selectedEntryIds = response.data.map((entry) => entry.id);
    } else {
      selectedEntryIds = [];
    }
  }

  function resetSelectedRows(): void {
    selectedEntryIds = [];
  }
</script>

{#snippet AddEntryButton(className?: string)}
  <Can action="create" resource="dataset:entries" scopes={["as_org_owner", as_project_owner]}>
    <Button onclick={openNewEntryFormModal} class={className}>
      <PlusIcon />
      Add Entry
    </Button>
  </Can>
{/snippet}

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <div class="flex w-full gap-4">
      <div class="flex w-full flex-col items-center justify-between gap-4 lg:flex-row">
        <div class="flex flex-1 items-center gap-4">
          <!-- SELECT ALL -->
          {#if canUpdateEntry || canDeleteEntry}
            <div class="pl-6">
              <Checkbox checked={selectedEntryIds.length > 0} onCheckedChange={toggleSelectAll} />
            </div>
          {/if}

          <div class="flex flex-wrap gap-2">
            {#each Object.entries(entryColumns) as [columnKey, columnSetting] (columnKey)}
              <FilterSortDropdownMenu
                contexts={{
                  projectId: page.params.projectId,
                }}
                {columnKey}
                columnSetting={columnSetting as ColumnSettings<EntryRecord>}
                filters={listOptions.filters || {}}
                sort={listOptions.sort || []}
                onFilter={filterEntries}
                onSort={sortEntries}
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

        <div class={cn("w-full gap-2 lg:w-auto", isRowSelected ? "grid grid-cols-2" : "flex justify-end")}>
          <!-- BULK ACTIONS -->

          {#if isRowSelected}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" class="bg-primary/10 hover:bg-primary/20 w-full transition-opacity">
                  {selectedRowsCount} selected
                  <ChevronsUpDownIcon class="text-muted-foreground ml-2 size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuGroup>
                  {#each bulkActions as { label, icon: Icon, action, hidden }, index (index)}
                    {#if !hidden}
                      <DropdownMenuItem onclick={action}>
                        <Icon class="mr-2 size-4" />
                        {label}
                      </DropdownMenuItem>
                    {/if}
                  {/each}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          {/if}

          {@render AddEntryButton("w-full lg:w-auto")}
        </div>
      </div>
    </div>
  {/snippet}
</PageHeader>

<!-- LIST OF TASKS (ENTRY) -->
{#key $refetches.entries.list}
  {#await fetchEntries()}
    <Spinner />
  {:then _}
    <div class="flex flex-col gap-4">
      {#each response.data as entry (entry.id)}
        <EntryCard {entry} {selectedEntryIds} onRowSelect={selectRow} />
      {:else}
        <Card>
          <CardContent class="min-h-64 flex items-center justify-center">
            <ResponseBlock
              icon={LayoutListIcon}
              title={isFiltering ? "No entries found" : "No entries yet"}
              description={isFiltering ? "Try adjusting your filters." : "Please add entries to get started."}
            >
              {#snippet actions()}
                {#if !isFiltering}
                  {@render AddEntryButton()}
                {/if}
              {/snippet}
            </ResponseBlock>
          </CardContent>
        </Card>
      {/each}
    </div>

    <AppPaginator
      page={listOptions.pagination?.page || currentPage}
      itemsPerPage={listOptions.pagination?.itemsPerPage || itemsPerPage}
      count={response.meta?.count ?? 0}
      hasMore={response.meta?.more || false}
      onPageChange={changePage}
      onItemsPerPageSelect={setItemsPerPage}
    />
  {/await}
{/key}

<!-- MODAL::ADD TASK -->
<CreateEntryFormModal action="create" title="Entry" bind:open={openNewEntryModal} />

<!-- MODAL::ASSIGN ANNOTATOR  -->
<AssignEntryFormModal
  action="update"
  entryIds={selectedEntryIds}
  onAssigned={resetSelectedRows}
  entryRecord={selectedRowsCount === 1 ? response.data.find((entry) => entry.id === selectedEntryIds[0]) : undefined}
  bind:open={openAssignEntryFormModal}
/>

<!-- MODAL::SET PRIORITY -->
<UpdateEntryPriorityFormModal action="update" entryIds={selectedEntryIds} bind:open={openSetPriorityModal} />

<!-- MODAL::CONFIRM UNASSIGN -->
<ConfirmModal
  title="Unassign entry"
  description={`Are you sure you want to unassign ${selectedToUnassignedEntryIdsCount} ${pluralizeUnit(selectedToUnassignedEntryIdsCount, "entry", "entries")}?`}
  onConfirm={unAssignEntries}
  bind:open={openConfirmUnassignEntriesModal}
/>

<!-- MODAL::CONFIRM DELETE -->
<ConfirmModal
  title="Delete entry"
  description={`Are you sure you want to delete ${selectedRowsCount} ${pluralizeUnit(selectedRowsCount, "entry", "entries")}? This action cannot be undone.`}
  onConfirm={deleteEntries}
  bind:open={openConfirmDeleteEntriesModal}
/>

<ConfirmModal
  title="Export {selectedRowsCount} entries(s)"
  description="Are you sure you want to export {selectedRowsCount} entries(s)?"
  onConfirm={exportEntries}
  bind:open={openExportModal}
/>
