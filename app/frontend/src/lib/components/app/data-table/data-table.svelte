<script lang="ts" generics="T extends Record">
  import { onDestroy, onMount, setContext } from "svelte";

  import DataTableBody from "@/components/app/data-table/data-table-body.svelte";
  import DataTableContent from "@/components/app/data-table/data-table-content.svelte";
  import DataTableError from "@/components/app/data-table/data-table-error.svelte";
  import DataTableHeader from "@/components/app/data-table/data-table-header.svelte";
  import DataTableHeadLabel from "@/components/app/data-table/data-table-head-label.svelte";
  import DataTableHeadOptions from "@/components/app/data-table/data-table-head-options.svelte";
  import DataTableLoading from "@/components/app/data-table/data-table-loading.svelte";
  import DataTablePaginator from "@/components/app/data-table/data-table-paginator.svelte";
  import DataTableToggleColumns from "@/components/app/data-table/data-table-toggle-columns.svelte";
  import DataTableToolbarActions from "@/components/app/data-table/data-table-toolbar-actions.svelte";
  import Table from "@/components/ui/table/table.svelte";
  import TableHead from "@/components/ui/table/table-head.svelte";
  import TableHeader from "@/components/ui/table/table-header.svelte";
  import TableRow from "@/components/ui/table/table-row.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { Record } from "@/data/model/Record";

  import type {
    DataTableBaseProps,
    TableData,
    TablePreferences,
    TableState,
  } from "@/components/app/data-table/data-table.types";
  import type { ListOptions } from "@/data/DataSource";

  import { getTableState } from "@/components/app/data-table/data-table.stores.svelte";

  // Props
  interface Props extends DataTableBaseProps<T> {}
  let {
    id,
    name: dataTableName,
    title,
    dataSource,
    listOptions,
    columns: _columns,
    hidePagination,
    onLoadSetContexts = async () => ({}),
    actions,
  }: Props = $props();

  // Contexts
  setContext("columns", _columns);
  setContext("dataTableName", dataTableName);

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

  let currentPage: number = $state(1);
  let itemsPerPage: number = $state(10);

  // Lifecycle
  onMount(async () => {
    await fetchData();
  });

  onDestroy(
    tableState.tableData.subscribe((d) => {
      tableData = d;
    }),
  );

  // Functions
  async function fetchData() {
    /** Set TableData status to 'loading' */
    tableState.tableData.update((state) => ({ ...state, status: "loading" }));

    try {
      let listOpts: ListOptions = { ...listOptions };
      listOpts.pagination = { page: currentPage, itemsPerPage: itemsPerPage };
      listOpts.sort = listOpts.sort || ["-id"];
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
        pagination: { ...prefs.pagination, ...listOptions?.pagination },
      }));
    } catch (error) {
      /** Set TableData status to 'error'*/
      tableState.tableData.update((state) => ({ ...state, status: "error", error: error }));
      throw error;
    }
  }

  function hideColumn(columnToHide: string): void {
    columns[columnToHide].visible = false;
  }
</script>

<div id="data-table-container" class="flex flex-1 flex-col gap-2">
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

      {@render actions?.()}
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
                  <DataTableHeadLabel>{label}</DataTableHeadLabel>
                {:else}
                  <DataTableHeadOptions {columnKey} {columnSetting} onHide={hideColumn}></DataTableHeadOptions>
                {/if}
              </TableHead>
            {/if}
          {/each}
        </TableRow>
      </TableHeader>

      <!-- DATA TABLE::TABLE::ROWS -->

      {#if tableData.status === "loading"}
        <DataTableLoading />
      {:else if tableData.status === "loaded"}
        <DataTableBody {tableData} {columns}></DataTableBody>
      {:else}
        <DataTableError />
      {/if}
    </Table>
  </DataTableContent>

  <!-- DATA TABLE::PAGINATION -->
  {#if !hidePagination}
    <DataTablePaginator bind:page={currentPage} bind:itemsPerPage />
  {/if}
</div>
