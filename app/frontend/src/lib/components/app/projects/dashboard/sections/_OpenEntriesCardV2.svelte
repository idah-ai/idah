<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { PROJECT_DASHBOARD_OPEN_ENTRIES_TABS } from "../project-dashboard.constants";
  import { getColumns, enrichWithTimeData } from "./_OpenEntriesCardV2.table";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import EntryTimeCollapsibleTableRow from "./_EntryTimeCollapsibleTableRow.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import type { EntryWithTimeData } from "./_OpenEntriesCardV2.table";

  // ── Controller ──────────────────────────────────────────────────
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);

  // ── Columns ──────────────────────────────────────────────────────
  const columns = $derived(getColumns(!controller.singleDatasetView));

  // ── Enrich entries with time tracking data ───────────────────────
  const rows: EntryWithTimeData[] = $derived(controller.entryProgressRows.map((entry) => enrichWithTimeData(entry)));

  // Cache the last visible rows so the table never goes empty during loading
  let cachedRows: EntryWithTimeData[] = $state([]);
  $effect(() => {
    if (rows.length > 0) cachedRows = rows;
  });

  const displayRows = $derived(controller.entryProgressLoading && cachedRows.length > 0 ? cachedRows : rows);

  // ── Expand / collapse ────────────────────────────────────────────
  let expandedIds: string[] = $state([]);

  function toggleRow(id: string): void {
    if (expandedIds.includes(id)) {
      expandedIds = expandedIds.filter((i) => i !== id);
    } else {
      expandedIds = [...expandedIds, id];
    }
  }

  const allVisibleExpanded = $derived(displayRows.length > 0 && displayRows.every((r) => expandedIds.includes(r.id)));

  function toggleAll(): void {
    if (allVisibleExpanded) {
      expandedIds = [];
    } else {
      expandedIds = displayRows.map((r) => r.id);
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
          class="text-link hover:text-link-hover disabled:text-muted-foreground text-sm font-medium disabled:cursor-not-allowed"
          disabled={displayRows.length === 0}
          onclick={toggleAll}
        >
          {allVisibleExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {#if controller.entryProgressError && displayRows.length === 0 && !controller.entryProgressLoading}
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
      {:else if displayRows.length === 0 && !controller.scopeReady}
        <div class="flex min-h-32 items-center justify-center" role="status" aria-label="Loading entries">
          <Spinner size="sm" />
        </div>
      {:else}
        <div class="relative">
          {#if controller.entryProgressLoading}
            <div class="bg-background/60 absolute inset-0 z-10 flex items-start justify-center rounded-lg pt-8">
              <Spinner size="sm" />
            </div>
          {/if}

          {#if displayRows.length === 0}
            <ResponseBlock
              size="sm"
              title="No entries to display"
              description="No entries were returned for this tab and scope."
            />
          {/if}

          <div class={controller.entryProgressLoading ? "pointer-events-none opacity-40" : ""}>
            <div class="overflow-x-auto">
              <DataTable
                {columns}
                rows={displayRows}
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
                  <EntryTimeCollapsibleTableRow
                    {row}
                    expanded={expandedIds.includes(row.id)}
                    onToggle={toggleRow}
                    showDataset={!controller.singleDatasetView}
                  />
                {/snippet}
              </DataTable>
            </div>
          </div>
        </div>
      {/if}
    </Tabs>
  </Card.Content>
</Card.Root>
