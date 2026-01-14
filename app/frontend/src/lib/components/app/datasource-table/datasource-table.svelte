<script lang="ts" generics="T extends Record">
  import { onDestroy, onMount, setContext } from "svelte";

  import DataTableBody from "@/components/app/datasource-table/datasource-table-body.svelte";
  import DataTableContent from "@/components/app/datasource-table/datasource-table-content.svelte";
  import DataTableError from "@/components/app/datasource-table/datasource-table-error.svelte";
  import DataTableHeadLabel from "@/components/app/datasource-table/datasource-table-head-label.svelte";
  import DataTableHeadOptions from "@/components/app/datasource-table/datasource-table-head-options.svelte";
  import DataTableHeader from "@/components/app/datasource-table/datasource-table-header.svelte";
  import DataTableLoading from "@/components/app/datasource-table/datasource-table-loading.svelte";
  import DataTablePaginator from "@/components/app/datasource-table/datasource-table-paginator.svelte";
  import DataTableToggleColumns from "@/components/app/datasource-table/datasource-table-toggle-columns.svelte";
  import DataTableToolbarActions from "@/components/app/datasource-table/datasource-table-toolbar-actions.svelte";
  import TableHead from "@/components/ui/table/table-head.svelte";
  import TableHeader from "@/components/ui/table/table-header.svelte";
  import TableRow from "@/components/ui/table/table-row.svelte";
  import Table from "@/components/ui/table/table.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { getTableState } from "@/components/app/datasource-table/datasource-table.stores.svelte";
  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";

  import type {
    DataTableBaseProps,
    FilterDataSourceParams,
    SortDataSourceParams,
    TableData,
    TablePreferences,
    TableState,
  } from "@/components/app/datasource-table/types";

  import type { ListOptions } from "@/data/DataSource";

  // Props
  let {
    id,
    name: dataTableName,
    title,
    refetchKey,
    dataSource,
    listOptions,
    columns: _columns,
    hidePagination,
    onLoadSetContexts = async () => ({}),
    actions,
    addNewRecordButton,
    emptyState,
    filteredState,
  }: DataTableBaseProps<T> = $props();

  // Contexts
  setContext("id", id);
  setContext("columns", _columns);
  setContext("dataTableName", dataTableName);
  setContext("refetchKey", refetchKey);
  setContext("addNewRecordButton", addNewRecordButton);
  setContext("emptyState", emptyState);
  setContext("filteredState", filteredState);

  // Variables
  let tableState: TableState<T> = getTableState(id);
  let tableData: TableData<T> = $state({
    status: "loading",
    error: null,
    response: { data: [], meta: {} },
    contexts: {},
  });
  let tablePreferences: TablePreferences = $state({
    selectedRows: [],
    filters: {},
    pagination: {
      page: 1,
      itemsPerPage: 10,
    },
    sort: [],
  });

  let columns = $state(_columns);
  let haveSomeHidableColumns: boolean = $derived(Object.values(columns).some((column) => column.hidable));
  let isFiltering: boolean = $derived(Object.keys(tablePreferences.filters).length > 0);

  let currentPage: number = $state(1);
  let itemsPerPage: number = $state(10);

  // Lifecycle
  onMount(() => {
    fetchData();
  });

  onDestroy(
    tableState.tableData.subscribe((data) => {
      tableData = data;
    }),
  );

  onDestroy(
    tableState.tablePreferences.subscribe((prefs) => {
      tablePreferences = prefs;
    }),
  );

  // Functions
  async function fetchData() {
    /** Set TableData status to 'loading' */
    tableState.tableData.update((state) => ({ ...state, status: "loading" }));

    try {
      let listOpts: ListOptions = { ...listOptions };

      /** Merge filters from tablePreferences and listOptions */
      const mergedFilters = { ...listOptions?.filters, ...tablePreferences.filters };

      /** Merged sort from tablePreferences and listOptions */
      const mergedSort = Array.from(new Set([...(listOptions?.sort || []), ...(tablePreferences.sort || [])]));

      /** Merged pagination from tablePreferences and listOptions */
      const mergedPagination = { ...listOptions?.pagination, ...tablePreferences.pagination };

      /** Remove `undefined` value from mergedFilters */
      listOpts.filters = Object.fromEntries(Object.entries(mergedFilters).filter(([_, value]) => value !== undefined));
      listOpts.pagination = mergedPagination;
      listOpts.sort = mergedSort.length > 0 ? mergedSort : ["-id"];
      listOpts.count = true;

      const response = await dataSource.list(listOpts);
      const contexts = await onLoadSetContexts(response);

      /** Update TableData */
      tableState.tableData.update((state) => ({
        ...state,
        status: "loaded",
        response: response,
        contexts: contexts,
      }));

      /** Update TablePreferences */
      tableState.tablePreferences.update((prefs) => ({
        ...prefs,
        filters: mergedFilters,
        pagination: { ...prefs.pagination, ...mergedPagination },
        sort: mergedSort,
      }));
    } catch (error) {
      /** Set TableData status to 'error'*/
      tableState.tableData.update((state) => ({ ...state, status: "error", error: error }));
      throw error;
    }
  }

  function resetToFirstPage(): void {
    currentPage = 1;
  }

  async function filterDataSource(params: FilterDataSourceParams): Promise<void> {
    const { filters } = params;

    tableState.tablePreferences.update((prefs) => {
      const updatedFilters = { ...prefs.filters };

      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) {
          delete updatedFilters[key];
        } else {
          updatedFilters[key] = value;
        }
      }

      /** Reset to first page when filters are applied */
      resetToFirstPage();

      return {
        ...prefs,
        filters: updatedFilters,
        pagination: { ...prefs.pagination, page: currentPage },
      };
    });

    await fetchData();
  }

  async function sortDataSource(params: SortDataSourceParams): Promise<void> {
    const { columnKey, sortDirection } = params;
    const sortPrefix: string = sortDirection === "desc" ? "-" : "";
    const sortKey: string = `${sortPrefix}${columnKey}`;

    /** Update TablePreferences */
    tableState.tablePreferences.update((prefs) => {
      if (sortDirection === "none") {
        /** Remove all sortKey from TablePreferences */
        return {
          ...prefs,
          sort: prefs.sort.filter((currentSorting) => !currentSorting.endsWith(columnKey)),
        };
      } else {
        /** Add or update sortKey to TablePreferences */
        if (prefs.sort.some((currentSorting) => currentSorting.endsWith(columnKey))) {
          // If the column is already sorted, replace it with the new sortKey
          return {
            ...prefs,
            sort: prefs.sort.map((currentSorting) => (currentSorting.endsWith(columnKey) ? sortKey : currentSorting)),
          };
        } else {
          // If the column is not sorted yet, add the new sortKey
          return {
            ...prefs,
            sort: [...prefs.sort, sortKey],
          };
        }
      }
    });

    await fetchData();
  }

  async function changePage(changeToPage: number): Promise<void> {
    currentPage = changeToPage;

    tableState.tablePreferences.update((prefs) => ({
      ...prefs,
      pagination: { ...prefs.pagination, page: changeToPage },
    }));

    await fetchData();
  }

  async function setItemsPerPage(selectedItemsPerPage: number): Promise<void> {
    itemsPerPage = selectedItemsPerPage;

    /** Reset to first page when filters are applied */
    resetToFirstPage();

    tableState.tablePreferences.update((prefs) => ({
      ...prefs,
      pagination: { ...prefs.pagination, page: currentPage, itemsPerPage: selectedItemsPerPage },
    }));

    await fetchData();
  }

  function hideColumn(columnToHide: string): void {
    columns[columnToHide].visible = false;
  }
</script>

<div id="datasource-table-container" class="flex flex-1 flex-col gap-2">
  <DataTableHeader>
    <!-- DATA TABLE::TITLE -->
    {#if title}
      <Text size="h3" weight="semibold">{title}</Text>
    {/if}

    <!-- DATA TABLE::ACTIONS -->
    <DataTableToolbarActions>
      {#if haveSomeHidableColumns}
        <DataTableToggleColumns {columns} />
      {/if}

      {@render actions?.({ tablePreferences })}
    </DataTableToolbarActions>
  </DataTableHeader>

  <!-- DATA TABLE::TABLE -->
  <DataTableContent>
    <Table>
      <!-- DATA TABLE::TABLE::HEADER -->
      <TableHeader>
        <TableRow>
          {#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
            {@const { label, align, filterable, sortable, visible } = columnSetting}
            {#if visible}
              <TableHead
                class={cn(
                  "bg-primary/10 first:rounded-tl-md last:rounded-tr-md",
                  align ? `text-${align}` : "text-left",
                )}
              >
                {#if !filterable && !sortable}
                  <DataTableHeadLabel class="px-4">{label}</DataTableHeadLabel>
                {:else}
                  <DataTableHeadOptions
                    {tableData}
                    {columnKey}
                    {columnSetting}
                    {tablePreferences}
                    onFilter={filterDataSource}
                    onSort={sortDataSource}
                    onHide={hideColumn}
                  />
                {/if}
              </TableHead>
            {/if}
          {/each}
        </TableRow>
      </TableHeader>

      {#if tableData.status === "loading"}
        <DataTableLoading />
      {:else if tableData.status === "loaded"}
        <DataTableBody {tableData} {columns} {isFiltering} />
      {:else}
        <DataTableError />
      {/if}
    </Table>
  </DataTableContent>

  <!-- DATA TABLE::PAGINATION -->
  {#if !hidePagination}
    <DataTablePaginator
      page={tablePreferences.pagination.page || currentPage}
      itemsPerPage={tablePreferences.pagination.itemsPerPage || itemsPerPage}
      count={tableData.response.meta?.count ?? 0}
      hasMore={tableData.response.meta?.more || false}
      onPageChange={changePage}
      onItemsPerPageSelect={setItemsPerPage}
    />
  {/if}
</div>
