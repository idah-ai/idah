<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import DataTable from "@/components/app/data-table/DataTable.svelte";
  import DataTablePaginator from "@/components/app/data-table/_DataTablePaginator.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { columns } from "@/components/app/projects/dashboard/sections/_ProgressByDatasetCard.table";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const rows = $derived(controller.datasetProgressRows);
  const pagination = $derived(controller.datasetProgressTablePagination);

  // Functions
  function changePage(page: number): Promise<void> {
    return controller.changeDatasetProgressPage({
      page,
      itemsPerPage: controller.datasetProgressPagination.itemsPerPage,
    });
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Progress by dataset</Card.Title>
    {#if controller.focused}
      <Card.Action>
        <Link href={`/projects/${controller.projectId}/datasets/${controller.focused.id}/entries`}>All entries</Link>
      </Card.Action>
    {/if}
  </Card.Header>
  <Card.Content>
    {#if controller.datasetProgressError}
      <ResponseBlock size="sm" title="Dataset progress unavailable" description={controller.datasetProgressError}>
        {#snippet actions()}
          <Button
            variant="outline"
            size="sm"
            disabled={controller.denied || controller.loading || controller.datasetProgressLoading}
            onclick={() => void controller.retryDatasetProgress()}>Retry</Button
          >
        {/snippet}
      </ResponseBlock>
    {:else if controller.loading || controller.datasetProgressLoading || !controller.scopeReady}
      <div class="flex min-h-32 items-center justify-center" role="status" aria-label="Loading dataset progress">
        <Spinner size="sm" />
      </div>
    {:else if !rows.length}
      <ResponseBlock
        size="sm"
        title="No datasets to display"
        description="No datasets were returned for this page and scope."
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
        caption={controller.datasetProgressCaption}
      />
    {/if}
  </Card.Content>
</Card.Root>
