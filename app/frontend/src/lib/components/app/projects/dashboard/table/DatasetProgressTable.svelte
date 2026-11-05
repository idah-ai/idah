<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import type { Writable } from "svelte/store";

  import AppTable from "@/components/app/table/table.svelte";
  import AppTableHeader from "@/components/app/table/tableHeader.svelte";
  import AppTableBody from "@/components/app/table/tableBody.svelte";
  import { TableRow, TableCell } from "@/components/ui/table";
  import { Progress } from "@/components/ui/progress";
  import { Button } from "@/components/ui/button";
  import DateText from "@/components/app/texts/date-text.svelte";
  import DeliveryBadge from "@/components/app/projects/dashboard/DeliveryBadge.svelte";
  import { deliveryDate, datasetDeliveryDate } from "@/components/app/projects/dashboard/DashboardStatus";

  import type { ProjectDashboardDataSources } from "@/components/app/projects/dashboard/DashboardData";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { TablePreferences } from "@/components/app/datasource-table/types";
  import type { CollectionResponse } from "@/data/model/types";

  // Props
  let {
    sources,
    ids,
    choose,
    preferences,
  }: {
    preferences: Writable<TablePreferences>;
    sources: ProjectDashboardDataSources;
    ids: string[];
    choose: (record: DatasetRecord, page?: number | null) => void;
  } = $props();

  // Variables
  const source = untrack(() => sources.table(ids));
  const tableColumns = [
    { label: "Dataset" },
    { label: "Entries", class: "text-right" },
    { label: "Progress" },
    { label: "Annotations", class: "text-right" },
    { label: "Delivery date" },
    { label: "Delivery status" },
  ];

  let response: CollectionResponse<DatasetRecord> = $state.raw({ data: [], meta: {} });
  let status: "loading" | "ready" | "error" = $state("loading");
  let error = $state("");
  let generation = 0;

  // Initialize
  onMount(() => {
    void load();
  });
  onDestroy(() => {
    generation++;
  });

  // Functions
  async function load(): Promise<void> {
    const token = ++generation;
    status = "loading";
    error = "";
    const pagination = { ...$preferences.pagination };
    try {
      const result = await source.list({ pagination, sort: ["name", "id"], count: true });
      await source.synchronize(result);
      if (token !== generation) return;
      response = result;
      status = "ready";
    } catch (reason) {
      if (token !== generation) return;
      error = reason instanceof Error ? reason.message : "Unable to load datasets.";
      status = "error";
    }
  }

  async function changePage(page: number): Promise<void> {
    preferences.update((prefs) => ({ ...prefs, pagination: { ...prefs.pagination, page } }));
    await load();
  }

  async function changePageSize(itemsPerPage: number): Promise<void> {
    preferences.update((prefs) => ({ ...prefs, pagination: { page: 1, itemsPerPage } }));
    await load();
  }
</script>

<AppTable
  label="Progress by dataset"
  class="min-w-[800px]"
  loading={status === "loading"}
  pagination={{
    page: $preferences.pagination.page,
    itemsPerPage: $preferences.pagination.itemsPerPage,
    count: response.meta?.count ?? 0,
    hasMore: response.meta?.more === true,
    onPageChange: changePage,
    onItemsPerPageSelect: changePageSize,
  }}
>
  <AppTableHeader columns={tableColumns} />
  <AppTableBody
    {status}
    label="Datasets"
    colspan={tableColumns.length}
    empty={response.data.length === 0}
    {error}
    onRetry={load}
  >
    {#each response.data as record (record.id)}
      {@const total = record.entries_total_count}
      {@const completed = record.entries_completed_count}
      {@const valid =
        Number.isSafeInteger(total) &&
        Number.isSafeInteger(completed) &&
        total >= 0 &&
        completed >= 0 &&
        completed <= total}
      {@const percentage = valid ? (total ? Math.round((completed / total) * 100) : 0) : null}
      <TableRow class="last:border-0">
        <TableCell class="max-w-80 py-2 pl-0">
          <Button
            variant="link"
            class="h-auto justify-start p-0 text-left font-semibold [overflow-wrap:anywhere] whitespace-normal"
            onclick={() => choose(record, source.position(record.id, response))}
          >
            {record.name}
          </Button>
        </TableCell>

        <TableCell class="text-right tabular-nums">
          {Number.isSafeInteger(total) && total >= 0 ? total.toLocaleString() : "—"}
        </TableCell>

        <TableCell>
          {#if percentage !== null}
            <div class="min-w-44 space-y-1.5">
              <Progress value={percentage} class="bg-muted h-2" aria-label={record.name + " completed entries"} />
              <div class="flex justify-between gap-3 text-xs tabular-nums">
                <span class="text-muted-foreground">
                  {completed.toLocaleString()} / {total.toLocaleString()}
                </span>
                <strong>{percentage}%</strong>
              </div>
            </div>
          {:else}
            <span class="text-muted-foreground"> — </span>
          {/if}
        </TableCell>

        <TableCell
          class="text-muted-foreground text-right"
          title="Dataset annotation totals are unavailable."
          aria-label={"Annotation total unavailable for " + record.name}
        >
          —
        </TableCell>

        <TableCell class="text-muted-foreground whitespace-nowrap">
          {#if datasetDeliveryDate(record)}
            <DateText datetime={deliveryDate(datasetDeliveryDate(record))} datetimeFormat="MMM dd, yyyy" size="sm" />
          {:else}
            —
          {/if}
        </TableCell>

        <TableCell class="pr-0">
          {#if valid}
            <DeliveryBadge date={datasetDeliveryDate(record)} counts={{ total, completed }} />
          {:else}
            —
          {/if}
        </TableCell>
      </TableRow>
    {/each}
  </AppTableBody>
</AppTable>
