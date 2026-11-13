<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { PROJECT_DASHBOARD_OPEN_ENTRIES_TABS } from "../project-dashboard.constants";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import { getColumns } from "@/components/app/projects/dashboard/sections/_OpenEntriesCard.table";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const columns = $derived(getColumns(!controller.focused));
  const rows = $derived(controller.entryProgressRows);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Open entries</Card.Title>
  </Card.Header>

  <Card.Content>
    <Tabs value={controller.entryTab} onValueChange={(value) => controller.changeEntryTab(value)}>
      <div class="flex items-center justify-between gap-4">
        <TabsList>
          {#each PROJECT_DASHBOARD_OPEN_ENTRIES_TABS as { label, value } (value)}
            <TabsTrigger {value}>
              {label} ({value === "all"
                ? (controller.summary?.total.toLocaleString() ?? "—")
                : value === "open"
                  ? (controller.openEntriesCount?.toLocaleString() ?? "—")
                  : (controller.summary?.completed.toLocaleString() ?? "—")})
            </TabsTrigger>
          {/each}
        </TabsList>

        <Button variant="link" size="sm" class="text-right" disabled>Expand all</Button>
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
      {:else if !rows.length}
        <ResponseBlock
          size="sm"
          title="No entries to display"
          description="No entries were returned for this tab and scope."
        />
      {:else}
        <ScrollArea class="max-h-[80vh]">
          <DataTable {columns} {rows} caption={controller.entryProgressCaption} />
        </ScrollArea>
      {/if}
    </Tabs>
  </Card.Content>
</Card.Root>
