<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import type { Writable } from "svelte/store";

  import DataTablePaginator from "@/components/app/datasource-table/datasource-table-paginator.svelte";
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
  import { Progress } from "@/components/ui/progress";
  import { Button } from "@/components/ui/button";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import DeliveryBadge from "@/components/app/projects/dashboard/DeliveryBadge.svelte";
  import { deliveryDate, datasetDeliveryDate } from "@/components/app/projects/dashboard/DashboardStatus";

  import type { ProjectDashboardDataSources } from "@/components/app/projects/dashboard/DashboardData";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { TablePreferences } from "@/components/app/datasource-table/types";
  import type { CollectionResponse } from "@/data/model/types";

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

  const source = untrack(() => sources.table(ids));
  let response: CollectionResponse<DatasetRecord> = $state.raw({ data: [], meta: {} });
  let status: "loading" | "ready" | "error" = $state("loading");
  let error = $state("");
  let generation = 0;

  onMount(() => {
    void load();
  });
  onDestroy(() => {
    generation++;
  });

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

<div class="px-6" aria-busy={status === "loading"}>
  <div class="overflow-x-auto">
    <Table aria-label="Progress by dataset" class="min-w-[800px]">
      <TableHeader
        ><TableRow class="hover:bg-transparent">
          <TableHead class="text-muted-foreground h-8 pl-0 text-xs">Dataset</TableHead>
          <TableHead class="text-muted-foreground h-8 text-right text-xs">Entries</TableHead>
          <TableHead class="text-muted-foreground h-8 w-[27%] text-xs">Progress</TableHead>
          <TableHead class="text-muted-foreground h-8 text-right text-xs">Annotations</TableHead>
          <TableHead class="text-muted-foreground h-8 text-xs">Delivery date</TableHead>
          <TableHead class="text-muted-foreground h-8 pr-0 text-xs">Delivery status</TableHead>
        </TableRow></TableHeader
      >
      <TableBody>
        {#if status === "loading"}
          <TableRow
            ><TableCell colspan={6} class="py-8 text-center"
              ><Spinner class="mx-auto" aria-label="Loading datasets" /></TableCell
            ></TableRow
          >
        {:else if status === "error"}
          <TableRow
            ><TableCell colspan={6}
              ><ResponseBlock size="sm" title="Datasets unavailable" description={error}>
                {#snippet actions()}<Button variant="outline" size="sm" onclick={() => void load()}>Retry</Button
                  >{/snippet}
              </ResponseBlock></TableCell
            ></TableRow
          >
        {:else if response.data.length === 0}
          <TableRow
            ><TableCell colspan={6} class="text-muted-foreground py-8 text-center">No datasets on this page.</TableCell
            ></TableRow
          >
        {:else}
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
                  onclick={() => choose(record, source.position(record.id, response))}>{record.name}</Button
                >
              </TableCell>
              <TableCell class="text-right tabular-nums"
                >{Number.isSafeInteger(total) && total >= 0 ? total.toLocaleString() : "—"}</TableCell
              >
              <TableCell>
                {#if percentage !== null}
                  <div class="min-w-44 space-y-1.5">
                    <Progress value={percentage} class="bg-muted h-2" aria-label={record.name + " completed entries"} />
                    <div class="flex justify-between gap-3 text-xs tabular-nums">
                      <span class="text-muted-foreground">{completed.toLocaleString()} / {total.toLocaleString()}</span
                      ><strong>{percentage}%</strong>
                    </div>
                  </div>
                {:else}<span class="text-muted-foreground">—</span>{/if}
              </TableCell>
              <TableCell
                class="text-muted-foreground text-right"
                title="Dataset annotation totals are unavailable."
                aria-label={"Annotation total unavailable for " + record.name}>—</TableCell
              >
              <TableCell class="text-muted-foreground whitespace-nowrap">
                {#if datasetDeliveryDate(record)}<DateText
                    datetime={deliveryDate(datasetDeliveryDate(record))}
                    datetimeFormat="MMM dd, yyyy"
                    size="sm"
                  />{:else}—{/if}
              </TableCell>
              <TableCell class="pr-0"
                >{#if valid}<DeliveryBadge
                    date={datasetDeliveryDate(record)}
                    counts={{ total, completed }}
                  />{:else}—{/if}</TableCell
              >
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>
  </div>
  <div class="py-3">
    <DataTablePaginator
      page={$preferences.pagination.page}
      itemsPerPage={$preferences.pagination.itemsPerPage}
      count={response.meta?.count ?? 0}
      hasMore={response.meta?.more === true}
      onPageChange={changePage}
      onItemsPerPageSelect={changePageSize}
    />
  </div>
</div>
