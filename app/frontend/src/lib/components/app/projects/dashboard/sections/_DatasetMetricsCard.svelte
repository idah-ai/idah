<script lang="ts">
  import * as Card from "@/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import DatasetNeedingAttentionMetric from "@/components/app/projects/dashboard/metrics/_DatasetNeedingAttentionMetric.svelte";
  import OpenEntriesMetric from "@/components/app/projects/dashboard/metrics/_OpenEntriesMetric.svelte";
  import OverallProgressMetric from "@/components/app/projects/dashboard/metrics/_OverallProgressMetric.svelte";
  import TotalEntriesMetric from "@/components/app/projects/dashboard/metrics/_TotalEntriesMetric.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<Card.Root class="p-0">
  <Card.Content class="grid p-0 md:grid-cols-4">
    <TotalEntriesMetric />
    <OverallProgressMetric />
    <OpenEntriesMetric />
    <DatasetNeedingAttentionMetric />
  </Card.Content>

  {#if controller.summaryError || controller.attentionError}
    <div class="space-y-2 border-t p-4">
      {#if controller.summaryError}
        <ResponseBlock size="sm" title="Entry counts unavailable" description={controller.summaryError}>
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              disabled={controller.summaryLoading}
              onclick={() => void controller.retrySummary()}
            >
              Retry counts
            </Button>
          {/snippet}
        </ResponseBlock>
      {/if}

      {#if controller.attentionError}
        <ResponseBlock size="sm" title="Dataset attention unavailable" description={controller.attentionError}>
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              disabled={controller.attentionLoading}
              onclick={() => void controller.retryAttention()}
            >
              Retry attention
            </Button>
          {/snippet}
        </ResponseBlock>
      {/if}
    </div>
  {/if}
</Card.Root>
