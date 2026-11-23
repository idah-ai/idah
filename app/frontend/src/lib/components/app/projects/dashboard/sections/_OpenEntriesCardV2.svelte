<script lang="ts">
  import { tick } from "svelte";
  import * as Card from "$lib/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { PROJECT_DASHBOARD_OPEN_ENTRIES_TABS } from "../project-dashboard.constants";
  import { getColumns, enrichWithTimeData } from "./_OpenEntriesCardV2.table";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import DataTablePaginator from "@/components/app/data-table/_DataTablePaginator.svelte";
  import EntryTimeCollapsibleTableRow from "./_EntryTimeCollapsibleTableRow.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import type { EntryWithTimeData } from "./_OpenEntriesCardV2.table";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const columns = $derived(getColumns(!controller.singleDatasetView));
  const rows: EntryWithTimeData[] = $derived(controller.entryProgressRows.map((entry) => enrichWithTimeData(entry)));
  const pagination = $derived(controller.entryProgressTablePagination);

  let section: HTMLDivElement | null = $state(null);
  let tableArea: HTMLDivElement;
  let loadingHeight = $state(0);

  // Functions
  export async function showOpenEntries(): Promise<void> {
    if (controller.entryTab !== "open") changeTab("open");
    await tick();
    section?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }

  function preserveHeight(): void {
    loadingHeight = tableArea.getBoundingClientRect().height;
  }

  function changeTab(value: string): void {
    preserveHeight();
    controller.changeEntryTab(value);
  }

  function changePage(page: number): Promise<void> {
    preserveHeight();
    return controller.changeEntryProgressPage({
      page,
      itemsPerPage: controller.entryProgressPagination.itemsPerPage,
    });
  }

  // ── Expand / collapse ────────────────────────────────────────────
  let expandedIds: string[] = $state([]);

  function toggleRow(id: string): void {
    if (expandedIds.includes(id)) {
      expandedIds = expandedIds.filter((i) => i !== id);
    } else {
      expandedIds = [...expandedIds, id];
    }
  }

  const allVisibleExpanded = $derived(rows.length > 0 && rows.every((r) => expandedIds.includes(r.id)));

  function toggleAll(): void {
    if (allVisibleExpanded) {
      expandedIds = [];
    } else {
      expandedIds = rows.map((r) => r.id);
    }
  }
</script>

<Card.Root bind:ref={section} class="scroll-mt-4">
  <Card.Header>
    <Card.Title>Open entries V2</Card.Title>
  </Card.Header>

  <Card.Content>
    <Tabs value={controller.entryTab} onValueChange={changeTab}>
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
          disabled={rows.length === 0}
          onclick={toggleAll}
        >
          {allVisibleExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div
        bind:this={tableArea}
        style:min-height={controller.entryProgressLoading ? `${loadingHeight}px` : undefined}
        aria-busy={controller.entryProgressLoading}
      >
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
        {:else if !rows.length}
          <ResponseBlock
            size="sm"
            title="No entries to display"
            description="No entries were returned for this tab and scope."
          />
          {#if pagination && pagination.page > 1}
            <DataTablePaginator {...pagination} onPageChange={changePage} class="mt-3" />
          {/if}
        {:else}
          <DataTable
            {columns}
            {rows}
            {pagination}
            showPaginator={pagination !== undefined}
            onPageChange={changePage}
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
        {/if}
      </div>
    </Tabs>
  </Card.Content>
</Card.Root>
