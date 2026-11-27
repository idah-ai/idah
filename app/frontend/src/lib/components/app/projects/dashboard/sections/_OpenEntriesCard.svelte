<script lang="ts">
  import { tick } from "svelte";
  import * as Card from "$lib/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { PROJECT_DASHBOARD_OPEN_ENTRIES_TABS } from "../project-dashboard.constants";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import DataTablePaginator from "@/components/app/data-table/_DataTablePaginator.svelte";
  import { getColumns } from "@/components/app/projects/dashboard/sections/_OpenEntriesCard.table";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const columns = $derived(getColumns(!controller.singleDatasetView));
  const rows = $derived(controller.entryProgressRows);
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
</script>

<Card.Root bind:ref={section} class="scroll-mt-4 gap-2">
  <Card.Header>
    <Card.Title>Progress by entry</Card.Title>
  </Card.Header>

  <Card.Content>
    <Tabs value={controller.entryTab} onValueChange={changeTab}>
      <div class="flex items-center justify-between gap-4">
        <TabsList class="h-auto flex-wrap">
          {#each PROJECT_DASHBOARD_OPEN_ENTRIES_TABS as { label, value } (value)}
            <TabsTrigger {value}>
              {label} ({value === "all"
                ? (controller.summary?.total.toLocaleString() ?? "-")
                : value === "open"
                  ? (controller.openEntriesCount?.toLocaleString() ?? "-")
                  : value === "not_ready"
                    ? (controller.summary?.processing.toLocaleString() ?? "-")
                    : value === "error"
                      ? (controller.summary?.errored.toLocaleString() ?? "-")
                      : (controller.summary?.completed.toLocaleString() ?? "-")})
            </TabsTrigger>
          {/each}
        </TabsList>

        <!-- <Button variant="link" size="sm" class="text-right" disabled>Expand all</Button> -->
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
          />
        {/if}
      </div>
    </Tabs>
  </Card.Content>
</Card.Root>
