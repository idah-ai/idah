<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import AppTable from "@/components/app/table/table.svelte";
  import AppTableHeader from "@/components/app/table/tableHeader.svelte";
  import AppTableBody from "@/components/app/table/tableBody.svelte";
  import { TableRow, TableCell } from "@/components/ui/table";
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

  // Props
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

  // Variables
  const tableColumns = $derived([
    { label: "Entry", class: "pl-0" },
    ...(combined ? [{ label: "Dataset" }] : []),
    { label: "Status" },
    { label: "Stage" },
    { label: "Assigned to" },
    { label: "In status", class: "pr-0 text-right" },
  ]);
  const dataSource = untrack(() => sources.openEntries(ids, combined));
  let response: CollectionResponse<EntryRecord> = $state.raw({ data: [], meta: {} });
  let contexts: { datasetNames?: { [id: string]: string } } = $state.raw({});
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

<AppTable
  label="Open entries"
  class={combined ? "min-w-[600px]" : "min-w-[500px]"}
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
    label="Open entries"
    colspan={tableColumns.length}
    empty={response.data.length === 0}
    {error}
    onRetry={load}
  >
    {#each response.data as record (record.id)}
      <TableRow class="last:border-0">
        <TableCell class="max-w-80 py-2 pl-0 [overflow-wrap:anywhere]">
          <NameCell {record} />
        </TableCell>

        {#if combined}
          <TableCell class="max-w-64 [overflow-wrap:anywhere]">
            <DatasetCell {record} {contexts} />
          </TableCell>
        {/if}

        <TableCell>
          <StatusCell {record} />
        </TableCell>

        <TableCell class="text-muted-foreground">
          {entryWorkflowSteps.find((step) => step.value === record.wf_step)?.label ?? "—"}
        </TableCell>

        <TableCell class="max-w-64 [overflow-wrap:anywhere]">
          <AssigneeCell {record} />
        </TableCell>

        <TableCell class="pr-0 text-right">
          <TimeCell {record} />
        </TableCell>
      </TableRow>
    {/each}
  </AppTableBody>
</AppTable>
