<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import DataTablePaginator from "@/components/app/datasource-table/datasource-table-paginator.svelte";
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import NameCell from "@/components/app/projects/dashboard/table/OpenEntryNameCell.svelte";
  import DatasetCell from "@/components/app/projects/dashboard/table/OpenEntryDatasetCell.svelte";
  import StatusCell from "@/components/app/projects/dashboard/table/OpenEntryStatusCell.svelte";
  import AssigneeCell from "@/components/app/projects/dashboard/table/OpenEntryAssigneeCell.svelte";
  import TimeCell from "@/components/app/projects/dashboard/table/OpenEntryTimeCell.svelte";
  import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";

  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import type { ProjectDashboardDataSources } from "@/components/app/projects/dashboard/DashboardData";
  import type { Writable } from "svelte/store";
  import type { TablePreferences } from "@/components/app/datasource-table/types";
  import type { CollectionResponse } from "@/data/model/types";

  let {
    sources,
    ids,
    combined,
    preferences,
  }: {
    sources: ProjectDashboardDataSources;
    ids: string[];
    combined: boolean;
    preferences: Writable<TablePreferences>;
  } = $props();
  const dataSource = untrack(() => sources.openEntries(ids, combined));
  let response: CollectionResponse<EntryRecord> = $state.raw({ data: [], meta: {} });
  let contexts: { datasetNames?: { [id: string]: string } } = $state.raw({});
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
      const result = await dataSource.list({ pagination, count: true });
      if (token !== generation) return;
      response = result;
      contexts = dataSource.contexts(result);
      status = "ready";
    } catch (reason) {
      if (token !== generation) return;
      error = reason instanceof Error ? reason.message : "Unable to load open entries.";
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
    <Table aria-label="Open entries" class={combined ? "min-w-[600px]" : "min-w-[500px]"}>
      <TableHeader
        ><TableRow class="hover:bg-transparent">
          <TableHead class="text-muted-foreground h-8 pl-0 text-xs">Entry</TableHead>
          {#if combined}<TableHead class="text-muted-foreground h-8 text-xs">Dataset</TableHead>{/if}
          <TableHead class="text-muted-foreground h-8 text-xs">Status</TableHead>
          <TableHead class="text-muted-foreground h-8 text-xs">Stage</TableHead>
          <TableHead class="text-muted-foreground h-8 text-xs">Assigned to</TableHead>
          <TableHead class="text-muted-foreground h-8 pr-0 text-right text-xs">In status</TableHead>
        </TableRow></TableHeader
      >
      <TableBody>
        {#if status === "loading"}
          <TableRow
            ><TableCell colspan={combined ? 6 : 5} class="py-8 text-center"
              ><Spinner class="mx-auto" aria-label="Loading open entries" /></TableCell
            ></TableRow
          >
        {:else if status === "error"}
          <TableRow
            ><TableCell colspan={combined ? 6 : 5}
              ><ResponseBlock size="sm" title="Open entries unavailable" description={error}>
                {#snippet actions()}<Button variant="outline" size="sm" onclick={() => void load()}>Retry</Button
                  >{/snippet}
              </ResponseBlock></TableCell
            ></TableRow
          >
        {:else if response.data.length === 0}
          <TableRow
            ><TableCell colspan={combined ? 6 : 5} class="text-muted-foreground py-8 text-center"
              >No open entries on this page.</TableCell
            ></TableRow
          >
        {:else}
          {#each response.data as record (record.id)}
            <TableRow class="last:border-0">
              <TableCell class="max-w-80 py-2 pl-0 [overflow-wrap:anywhere]"><NameCell {record} /></TableCell>
              {#if combined}<TableCell class="max-w-64 [overflow-wrap:anywhere]"
                  ><DatasetCell {record} {contexts} /></TableCell
                >{/if}
              <TableCell><StatusCell {record} /></TableCell>
              <TableCell class="text-muted-foreground"
                >{entryWorkflowSteps.find((step) => step.value === record.wf_step)?.label ?? "—"}</TableCell
              >
              <TableCell class="max-w-64 [overflow-wrap:anywhere]"><AssigneeCell {record} /></TableCell>
              <TableCell class="pr-0 text-right"><TimeCell {record} /></TableCell>
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
