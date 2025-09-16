<script lang="ts">
  import { page } from "$app/state";

  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent } from "@/components/ui/card";
  import EntryCard from "@/components/app/datasets/entries/cards/entry-card.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menu/filter-sort-dropdown-menu.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";

  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    FunnelIcon,
    LayoutListIcon,
    PlusIcon,
  } from "@lucide/svelte";

  import { cn } from "@/utils";
  import { entryColumns } from "@/components/app/datasets/entries/data-tables/entry-columns";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { Record } from "@/data/model/Record";

  import type { CollectionResponse } from "@/data/model/types";
  import type { ListOptions } from "@/data/DataSource";
  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
  } from "@/components/app/data-table/data-table.types";

  // Records
  let response: CollectionResponse<EntryRecord> = $state({
    data: [],
    meta: {},
  });

  // Variables
  let datasetId = page.params.datasetId as string;
  let currentPage: number = $state(1);
  let itemsPerPage: number = $state(10);
  let searchByName: string = $state("");
  let openNewTaskModal: boolean = $state(false);
  let showFilterAndSortingSection: boolean = $state(false);

  let listOptions: ListOptions = $state({
    fields: {
      [EntryRecord.type]: ["priority", "wf_step", "status", "resource", "assigned_to_id", "created_at", "updated_at"],
    },
    filters: {
      dataset_id: datasetId,
    },
    count: true,
  });
  let isFiltering: boolean = $derived(
    Object.keys(listOptions.filters || {}).filter((key) => key !== "dataset_id").length > 0,
  );
  let isSorting: boolean = $derived((listOptions.sort ?? []).length > 0);
  let isFilteringOrSorting: boolean = $derived(isFiltering || isSorting);

  // Functions
  async function fetchEntries(): Promise<void> {
    response = await entriesBackendDataSource.list(listOptions);
  }

  function showFilterAndSorting(): void {
    showFilterAndSortingSection = !showFilterAndSortingSection;
  }

  function resetToFirstPage(): void {
    currentPage = 1;
  }

  // function filterEntries(event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
  //   const value = event.currentTarget.value;
  //   searchByName = value;
  //   // await
  // }

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
</script>

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <div class="grid w-full gap-4">
      <div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
        <div class="flex items-center gap-4">
          <!-- SEARCH DATASET BY NAME -->
          <Input class="w-full md:min-w-64" placeholder="Search task name" value={searchByName} oninput={() => {}}
          ></Input>

          <!-- FILTERS & SORTING -->
          <Button
            variant="outline"
            class={cn("", {
              "bg-primary/20 hover:bg-primary/30 text-primary hover:text-primary": isFilteringOrSorting,
            })}
            onclick={showFilterAndSorting}
          >
            <FunnelIcon class="size-4" />
            {showFilterAndSortingSection ? "Hide" : "Show"} Filters & Sorting
          </Button>
        </div>

        <Button onclick={() => (openNewTaskModal = true)}>
          <PlusIcon class="size-4" />
          New Task
        </Button>
      </div>

      {#if showFilterAndSortingSection}
        <div class="grid w-full grid-cols-1 gap-4 md:grid-cols-5">
          {#each Object.entries(entryColumns) as [columnKey, columnSetting] (columnKey)}
            <FilterSortDropdownMenu
              {columnKey}
              columnSetting={columnSetting as ColumnSettings<Record>}
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
                    "data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground my-2 w-full gap-2 font-normal",
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
      {/if}
    </div>
  {/snippet}
</PageHeader>

<!-- LIST OF TASKS (ENTRY) -->
{#await fetchEntries()}
  <Spinner></Spinner>
{:then _}
  <div class="grid grid-cols-1 gap-4">
    {#each response.data as entry (entry.id)}
      <EntryCard {entry}></EntryCard>
    {:else}
      <Card>
        <CardContent class="min-h-64 flex items-center justify-center">
          <ResponseBlock
            icon={LayoutListIcon}
            title={isFiltering ? "No tasks found" : "No tasks yet"}
            description={isFiltering ? "Try adjusting your filters." : "Create a new task to get started."}
          ></ResponseBlock>
        </CardContent>
      </Card>
    {/each}
  </div>

  <AppPaginator
    page={listOptions.pagination?.page || currentPage}
    itemsPerPage={listOptions.pagination?.itemsPerPage || itemsPerPage}
    count={response.meta?.count || 1000}
    hasMore={response.meta?.more || false}
    onPageChange={changePage}
    onItemsPerPageSelect={setItemsPerPage}
  ></AppPaginator>
{/await}
