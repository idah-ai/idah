<script lang="ts">
  import DataTableHeadLabel from "@/components/app/datasource-table/datasource-table-head-label.svelte";
  import DataTableHeadOptions from "@/components/app/datasource-table/datasource-table-head-options.svelte";
  import { webhookCallLogsColumns } from "@/components/app/notification/webhook/call/data-tables/webhook-call-logs-columns";
  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const columns = webhookCallLogsColumns;
  let visibleColumns = $derived(Object.entries(columns).filter(([_, columnSetting]) => columnSetting.visible));
  let filteredJobs = $derived(jobs.filter(jobMatchesFilters));
  let sortedJobs = $derived([...filteredJobs].sort(compareJobs));
  let pagedJobs = $derived(sortedJobs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage));
  let tableData = $derived<TableData<WebhookCallRecord>>({
    status: error ? "error" : loading ? "loading" : "loaded",
    error,
    response: {
      data: sortedJobs,
      meta: { count: sortedJobs.length },
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

  $effect(() => {
    if (open && webhookRecord.id) {
      loadJobs();
    }
  });

  async function loadJobs(): Promise<void> {
    loading = true;
    error = null;

    try {
      const response = await webhooksBackendDataSource.jobs(webhookRecord.id);

      jobs = response.data;
      currentPage = 1;
    } catch (err) {
      error = err;
      jobs = [];
    } finally {
      loading = false;
    }
  }

  async function onPageChange(changeToPage: number): Promise<void> {
    currentPage = changeToPage;
  }

  async function onItemsPerPageSelect(selectedItemsPerPage: number): Promise<void> {
    rowsPerPage = selectedItemsPerPage;
    currentPage = 1;
  }

  async function onFilter(params: FilterDataSourceParams): Promise<void> {
    filters = cleanFilters({ ...filters, ...params.filters });
    currentPage = 1;
  }

  async function onSort(params: SortDataSourceParams): Promise<void> {
    if (params.sortDirection === "none") {
      sort = sort.filter((sortKey) => !sortKey.endsWith(params.columnKey));
    } else {
      const sortKey = params.sortDirection === "asc" ? params.columnKey : `-${params.columnKey}`;
      sort = [sortKey];
    }

    currentPage = 1;
  }

  function onHide(_columnKey: string): void {}

  function cleanFilters(nextFilters: Filters): Filters {
    return Object.fromEntries(Object.entries(nextFilters).filter(([_, value]) => value !== undefined)) as Filters;
  }

  function jobMatchesFilters(job: WebhookCallRecord): boolean {
    const createdAt = job.created_at?.getTime();
    const createdAtStart = parseFilterDate(filters.created_at__gte, "start");
    const createdAtEnd = parseFilterDate(filters.created_at__lte, "end");
    const httpCodeStart = filters.http_code__gte;
    const httpCodeEnd = filters.http_code__lte;

    if (createdAtStart && createdAt && createdAt < createdAtStart.getTime()) return false;
    if (createdAtEnd && createdAt && createdAt > createdAtEnd.getTime()) return false;
    if (typeof httpCodeStart === "number" && (job.http_code ?? 0) < httpCodeStart) return false;
    if (typeof httpCodeEnd === "number" && (job.http_code ?? 0) > httpCodeEnd) return false;

    return true;
  }

  function parseFilterDate(value: unknown, boundary: "start" | "end"): Date | null {
    if (!value || typeof value !== "string") return null;

    const fallbackTime = boundary === "start" ? "00:00:00" : "23:59:59";
    return new Date(value.includes(" ") ? value : `${value} ${fallbackTime}`);
  }

  function compareJobs(first: WebhookCallRecord, second: WebhookCallRecord): number {
    const sortKey = sort[0] ?? "-created_at";
    const sortDirection = sortKey.startsWith("-") ? -1 : 1;
    const fieldName = sortKey.replace("-", "") as "created_at" | "http_code";

    const firstValue = fieldName === "created_at" ? (first.created_at?.getTime() ?? 0) : (first.http_code ?? 0);
    const secondValue = fieldName === "created_at" ? (second.created_at?.getTime() ?? 0) : (second.http_code ?? 0);

    return (firstValue - secondValue) * sortDirection;
  }

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
  <DialogContent class="max-h-[90vh] max-w-[90vw] overflow-hidden p-0">
    <DialogHeader class="border-b px-6 py-5">
      <DialogTitle>Call logs of webhook</DialogTitle>
    </DialogHeader>

    <div class="px-6 py-6">
      <div class="overflow-hidden rounded-lg border">
        <div class="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader class="bg-muted/40">
              <TableRow>
                         {#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
            {@const { label, align, filterable, sortable, visible } = columnSetting}
            {#if visible}
              <TableHead
                class={cn(
                  "bg-primary/10  last:rounded-tr-md",
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
              {:else if sortedJobs.length === 0}
                <TableRow>
                  <TableCell colspan={visibleColumns.length} class="h-80 text-center text-lg font-semibold">
                    No call logs found.
                  </TableCell>
                </TableRow>
              {:else}
                {#each pagedJobs as job (job.id)}
                  <TableRow class="hover:bg-transparent">
                    {#each visibleColumns as [columnKey, columnSetting] (columnKey)}
                      {#if columnSetting.cellComponent}
                        {@const CellComponent = columnSetting.cellComponent}
                        <TableCell class="px-8 py-6 align-top">
                          <div class={cn(columnKey === "http_code" ? "flex justify-end" : "")}>
                            <CellComponent record={job} />
                          </div>
                        </TableCell>
                      {:else}
                        <TableCell class="px-8 py-6 align-top">
                          <div
                            class={cn("text-muted-foreground text-lg", {
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
            count={sortedJobs.length}
            hasMore={false}
            {onPageChange}
            {onItemsPerPageSelect}
          />
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
