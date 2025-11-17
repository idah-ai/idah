<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

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
  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { cn } from "@/utils";
  import { refetches } from "@/utils/refetch";

  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
  } from "@/components/app/datasource-table/types";
  import type { ListOptions } from "@/data/DataSource";
  import type { CollectionResponse } from "@/data/model/types";

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
  let currentPage: number = $state(1);
  let itemsPerPage: number = $state(10);
  let selectedRows: string[] = $state([]);
  let selectedRowsCount: number = $derived(selectedRows.length);
  let openNewEntryModal: boolean = $state(false);
  let openAssignEntryFormModal: boolean = $state(false);
  let openSetPriorityModal: boolean = $state(false);
  let openConfirmDeleteEntriesModal: boolean = $state(false);

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/entries`) },
    { label: "Entries" },
  ]);

  let listOptions: ListOptions = $state({
    filters: {
      dataset_id: datasetId,
    },
    sort: ["priority"],
    count: true,
  });
  let isFiltering: boolean = $derived(
    Object.keys(listOptions.filters || {}).filter((key) => key !== "dataset_id").length > 0,
  );
  let isRowSelected: boolean = $derived(selectedRowsCount > 0);

  const bulkActions = getEntryDropdownMenuActions({
    onAssign: () => {
      openAssignEntryFormModal = true;
    },
    onSetPriority: () => {
      openSetPriorityModal = true;
    },
    onDelete: () => {
      openConfirmDeleteEntriesModal = true;
    },
  });

  // Functions
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
    const { filters } = params;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) {
        /** Remove filter */
        delete listOptions.filters?.[key];
      } else {
        /** Add or update filter */
        listOptions = {
          ...listOptions,
          filters: {
            ...listOptions.filters,
            [key]: value,
          },
        };
      }
    }

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

    listOptions = {
      ...listOptions,
      pagination: {
        page: currentPage,
        itemsPerPage,
      },
    };

    await fetchEntries();
  }

  async function setItemsPerPage(selectedItemsPerPage: number): Promise<void> {
    resetToFirstPage();
    itemsPerPage = selectedItemsPerPage;

    listOptions = {
      ...listOptions,
      pagination: {
        page: currentPage,
        itemsPerPage,
      },
    };

    await fetchEntries();
  }

  function selectRow(selectedId: string): void {
    if (selectedRows.includes(selectedId)) {
      selectedRows = selectedRows.filter((id) => id !== selectedId);
    } else {
      selectedRows = [...selectedRows, selectedId];
    }
  }

  async function deleteEntries(): Promise<void> {
    for (const entryId of selectedRows) {
      await entriesBackendDataSource.delete(entryId);
    }

    toast.success(`${selectedRowsCount} Entry(s) successfully deleted.`);

    selectedRows = [];
    $refetches.entries.list = new Date();
    openConfirmDeleteEntriesModal = false;
  }

  function toggleSelectAll(checked: boolean): void {
    if (checked) {
      selectedRows = response.data.map((entry) => entry.id);
    } else {
      selectedRows = [];
    }
  }
</script>

{#snippet AddEntryButton()}
  <Button onclick={openNewEntryFormModal}>
    <PlusIcon class="size-4"></PlusIcon>
    Add Entry
  </Button>
{/snippet}

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <div class="flex w-full gap-4">
      <div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
        <div class="flex flex-1 items-center gap-4">
          <!-- SELECT ALL -->
          <div class="pl-6">
            <Checkbox checked={selectedRows.length > 0} onCheckedChange={toggleSelectAll}></Checkbox>
          </div>

          <div class="">
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
                      "data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground my-2 w-full min-w-60 gap-2 font-normal",
                      isFiltering || isSorting ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {#if isFiltering}
                      <FunnelIcon class="size-4"></FunnelIcon>
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

        <div class="flex items-center gap-2">
          <!-- BULK ACTIONS -->
          {#if isRowSelected}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" class="bg-primary/10 hover:bg-primary/20">
                  {selectedRowsCount} selected
                  <ChevronsUpDownIcon class="text-muted-foreground ml-2 size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuGroup>
                  {#each bulkActions as { label, icon: Icon, action }, index (index)}
                    <DropdownMenuItem onclick={action}>
                      <Icon class="mr-2 size-4" />
                      {label}
                    </DropdownMenuItem>
                  {/each}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          {/if}

          {@render AddEntryButton()}
        </div>
      </div>
    </div>
  {/snippet}
</PageHeader>

<!-- LIST OF TASKS (ENTRY) -->
{#key $refetches.entries.list}
  {#await fetchEntries()}
    <Spinner></Spinner>
  {:then _}
    <div class="flex flex-col gap-4">
      {#each response.data as entry (entry.id)}
        <EntryCard {entry} {selectedRows} onRowSelect={selectRow}></EntryCard>
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
    ></AppPaginator>
  {/await}
{/key}

<!-- MODAL::ADD TASK -->
<CreateEntryFormModal action="create" title="Entry" bind:open={openNewEntryModal} />

<!-- MODAL::ASSIGN ANNOTATOR  -->
<AssignEntryFormModal action="update" entryIds={selectedRows} bind:open={openAssignEntryFormModal} />

<!-- MODAL::SET PRIORITY -->
<UpdateEntryPriorityFormModal action="update" entryIds={selectedRows} bind:open={openSetPriorityModal} />

<!-- MODAL::CONFIRM DELETE -->
<ConfirmModal
  title="Delete {selectedRowsCount} entries(s)"
  description="Are you sure you want to delete {selectedRowsCount} entries(s)? This action cannot be undone."
  onConfirm={deleteEntries}
  bind:open={openConfirmDeleteEntriesModal}
/>
