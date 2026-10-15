<script lang="ts">
  import DataTableHeadLabel from "@/components/app/datasource-table/datasource-table-head-label.svelte";
  import DataTableHeadOptions from "@/components/app/datasource-table/datasource-table-head-options.svelte";
  import { webhookCallLogsColumns } from "@/components/app/notification/webhook/call/data-tables/webhook-call-logs-columns";
  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import { onMount } from "svelte";

  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";
  import { WebhookRecord, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { cn } from "@/utils";

  import type {
    FilterDataSourceParams,
    SortDataSourceParams,
    TableData,
    TablePreferences,
  } from "@/components/app/datasource-table/types";
  import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";
  import type { Sort } from "@/data/DataSource";
  import type { Filters } from "@/data/filtering";

  // Props
  interface Props extends ModalBaseProps {
    webhookRecord: WebhookRecord;
  }
  let { open = $bindable(), webhookRecord }: Props = $props();

  // Variables
  let loading = $state(false);
  let error = $state<unknown>(null);
  let jobs = $state<WebhookCallRecord[]>([]);
  let filters = $state<Filters>({});
  let sort = $state<Sort>(["-created_at"]);
  let currentPage = $state(1);
  let rowsPerPage = $state(10);
  let count = $state(0);
  let hasMore = $state(false);

  const columns = webhookCallLogsColumns;
  let visibleColumns = $derived(Object.entries(columns).filter(([_, columnSetting]) => columnSetting.visible));
  let tableData = $derived<TableData<WebhookCallRecord>>({
    status: error ? "error" : loading ? "loading" : "loaded",
    error,
    response: {
      data: jobs,
      meta: { count, more: hasMore },
    },
    contexts: {},
  });
  let tablePreferences = $derived<TablePreferences>({
    selectedRows: [],
    filters,
    pagination: {
      page: currentPage,
      itemsPerPage: rowsPerPage,
    },
    sort,
  });

  onMount(() => {
    loadJobs();
  });

  async function loadJobs(): Promise<void> {
    loading = true;
    error = null;

    try {
      const response = await webhooksBackendDataSource.jobs(webhookRecord.id, {
        filters,
        sort,
        pagination: { page: currentPage, itemsPerPage: rowsPerPage },
        count: true,
      });

      jobs = response.data;
      count = response.meta?.count ?? 0;
      hasMore = response.meta?.more ?? false;
    } catch (err) {
      error = err;
      jobs = [];
      count = 0;
      hasMore = false;
    } finally {
      loading = false;
    }
  }

  async function onPageChange(changeToPage: number): Promise<void> {
    currentPage = changeToPage;
    await loadJobs();
  }

  async function onItemsPerPageSelect(selectedItemsPerPage: number): Promise<void> {
    rowsPerPage = selectedItemsPerPage;
    currentPage = 1;
    await loadJobs();
  }

  async function onFilter(params: FilterDataSourceParams): Promise<void> {
    filters = Object.fromEntries(
      Object.entries({ ...filters, ...params.filters }).filter(([_, value]) => value !== undefined),
    );
    currentPage = 1;
    await loadJobs();
  }

  async function onSort(params: SortDataSourceParams): Promise<void> {
    if (params.sortDirection === "none") {
      sort = sort.filter((sortKey) => !sortKey.endsWith(params.columnKey));
    } else {
      const sortKey = params.sortDirection === "asc" ? params.columnKey : `-${params.columnKey}`;
      sort = [sortKey];
    }

    currentPage = 1;
    await loadJobs();
  }

  function onHide(_columnKey: string): void {}

  function getCellValue(job: WebhookCallRecord, columnKey: string): string {
    switch (columnKey) {
      case "http_code":
        return `${job.http_code ?? "-"} ${job.httpStatus.label}`;
      default:
        return String(job[columnKey as keyof WebhookCallRecord] ?? "-");
    }
  }
</script>

<Dialog bind:open>
  <DialogContent class="flex max-h-[90vh] min-w-0 flex-col gap-0 p-0 sm:max-w-5xl">
    <DialogHeader class="shrink-0 border-b px-6 py-5">
      <DialogTitle>Call logs of webhook</DialogTitle>
    </DialogHeader>

    <div class="min-h-0 min-w-0">
      <Table class="w-full table-fixed">
        <TableHeader>
          <TableRow>
            {#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
              {@const { label, align, filterable, sortable, visible } = columnSetting}
              {#if visible}
                <TableHead class={cn("bg-primary/10 last:rounded-tr-md", align ? `text-${align}` : "text-left")}>
                  {#if !filterable && !sortable}
                    <DataTableHeadLabel class="px-4">{label}</DataTableHeadLabel>
                  {:else}
                    <DataTableHeadOptions
                      {tableData}
                      {columnKey}
                      {columnSetting}
                      {tablePreferences}
                      {onFilter}
                      {onSort}
                      {onHide}
                    />
                  {/if}
                </TableHead>
              {/if}
            {/each}
          </TableRow>
        </TableHeader>

        <TableBody>
          {#if loading}
            <TableRow>
              <TableCell colspan={visibleColumns.length} class="h-80">
                <div class="flex w-full items-center justify-center">
                  <Spinner size="lg" />
                </div>
              </TableCell>
            </TableRow>
          {:else if error}
            <TableRow>
              <TableCell colspan={visibleColumns.length} class="h-80 text-center text-lg font-semibold">
                Something went wrong.
              </TableCell>
            </TableRow>
          {:else if jobs.length === 0}
            <TableRow>
              <TableCell colspan={visibleColumns.length} class="h-80 text-center text-lg font-semibold">
                No call logs found.
              </TableCell>
            </TableRow>
          {:else}
            {#each jobs as job (job.id)}
              <TableRow class="hover:bg-transparent">
                {#each visibleColumns as [columnKey, columnSetting] (columnKey)}
                  {#if columnSetting.cellComponent}
                    {@const CellComponent = columnSetting.cellComponent}
                    <TableCell class="px-4 py-3 align-top">
                      <CellComponent record={job} />
                    </TableCell>
                  {:else}
                    <TableCell class="px-4 py-3 align-top">
                      <div
                        class={cn("text-muted-foreground text-sm", {
                          "text-right": columnKey === "http_code" || columnSetting.align === "right",
                          "text-center": columnSetting.align === "center",
                        })}
                      >
                        {getCellValue(job, columnKey)}
                      </div>
                    </TableCell>
                  {/if}
                {/each}
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>
    </div>

    <div class="border-t px-6 py-5">
      <AppPaginator
        page={currentPage}
        itemsPerPage={rowsPerPage}
        {count}
        {hasMore}
        {onPageChange}
        {onItemsPerPageSelect}
      />
    </div>
  </DialogContent>
</Dialog>
