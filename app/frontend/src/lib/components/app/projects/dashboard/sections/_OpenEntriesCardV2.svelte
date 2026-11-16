<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { PROJECT_DASHBOARD_OPEN_ENTRIES_TABS } from "../project-dashboard.constants";
  import { getColumns, enrichWithTimeData, TOTAL_TIME_SORT_KEY } from "./_OpenEntriesCardV2.table";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import EntryCollapsibleRow from "./_EntryCollapsibleRow.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import type { DataTableSortState } from "@/components/app/data-table/types";
  import type { EntryWithTimeData } from "./_OpenEntriesCardV2.table";

  // ── Controller ──────────────────────────────────────────────────
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);

  // ── Columns ──────────────────────────────────────────────────────
  const columns = $derived(getColumns(!controller.singleDatasetView));

  // ── Enrich entries with time tracking data ───────────────────────
  const rows: EntryWithTimeData[] = $derived(
    controller.entryProgressRows.map((entry) => enrichWithTimeData(entry)),
  );

  // ── Sort (client-side on current page, placeholder until BE support) ──
  let sort: DataTableSortState = $state({ key: TOTAL_TIME_SORT_KEY, dir: "desc" });

  function handleSort(next: DataTableSortState): void {
    sort = next;
  }

  const sortedRows = $derived.by(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: number, vb: number;
      if (key === TOTAL_TIME_SORT_KEY) {
        va = a.totalSeconds;
        vb = b.totalSeconds;
      } else {
        va = (a[key as keyof EntryWithTimeData] as any) ?? 0;
        vb = (b[key as keyof EntryWithTimeData] as any) ?? 0;
      }
      return (va < vb ? -1 : va > vb ? 1 : 0) * mul;
    });
    return arr;
  });

  // ── Expand / collapse ────────────────────────────────────────────
  let expandedIds: string[] = $state([]);

  function toggleRow(id: string): void {
    if (expandedIds.includes(id)) {
      expandedIds = expandedIds.filter((i) => i !== id);
    } else {
      expandedIds = [...expandedIds, id];
    }
  }

  const allVisibleExpanded = $derived(
    sortedRows.length > 0 && sortedRows.every((r) => expandedIds.includes(r.id)),
  );

  function toggleAll(): void {
    if (allVisibleExpanded) {
      expandedIds = [];
    } else {
      expandedIds = sortedRows.map((r) => r.id);
    }
  }

  // ── Pagination ───────────────────────────────────────────────────
  const pagination = $derived(controller.entryProgressTablePagination);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Open entries V2</Card.Title>
  </Card.Header>

  <Card.Content>
    <Tabs value={controller.entryTab} onValueChange={(value) => controller.changeEntryTab(value)}>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          {#each PROJECT_DASHBOARD_OPEN_ENTRIES_TABS as { label, value } (value)}
            <TabsTrigger {value}>
              {label}
              ({value === "all"
                ? (controller.summary?.total.toLocaleString() ?? "—")
                : value === "open"
                  ? (controller.openEntriesCount?.toLocaleString() ?? "—")
                  : (controller.summary?.completed.toLocaleString() ?? "—")})
            </TabsTrigger>
          {/each}
        </TabsList>

        <button
          class="text-sm font-medium text-link hover:text-link-hover disabled:text-muted-foreground disabled:cursor-not-allowed"
          disabled={sortedRows.length === 0}
          onclick={toggleAll}
        >
          {allVisibleExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {#if controller.entryProgressError}
        <ResponseBlock size="sm" title="Entries unavailable" description={controller.entryProgressError}>
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              disabled={controller.denied || controller.loading || controller.entryProgressLoading}
              onclick={() => void controller.retryEntryProgress()}>Retry</Button
            >
          {/snippet}
        </ResponseBlock>
      {:else if controller.loading || controller.entryProgressLoading || !controller.scopeReady}
        <div class="flex min-h-32 items-center justify-center" role="status" aria-label="Loading entries">
          <Spinner size="sm" />
        </div>
      {:else}
        {#if sortedRows.length === 0}
          <ResponseBlock
            size="sm"
            title="No entries to display"
            description="No entries were returned for this tab and scope."
          />
        {/if}
        <div class="overflow-x-auto">
          <DataTable
            {columns}
            rows={sortedRows}
            {sort}
            onSort={handleSort}
            showPaginator={pagination !== undefined}
            {pagination}
            onPageChange={(page) =>
              controller.changeEntryProgressPage({
                page,
                itemsPerPage: controller.entryProgressPagination.itemsPerPage,
              })}
            caption={controller.entryProgressCaption}
          >
            {#snippet RowComponent(row: EntryWithTimeData)}
              <EntryCollapsibleRow
                {row}
                expanded={expandedIds.includes(row.id)}
                onToggle={toggleRow}
                showDataset={!controller.singleDatasetView}
              />
            {/snippet}
          </DataTable>
        </div>
      {/if}
    </Tabs>
  </Card.Content>
</Card.Root>