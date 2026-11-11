<script lang="ts">
  import * as Card from "@/components/ui/card/index";
  import Button from "@/components/ui/button/button.svelte";
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
        <div class="flex flex-wrap items-center gap-2" role="alert">
          <p class="text-destructive text-sm">{controller.summaryError}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={controller.summaryLoading}
            onclick={() => void controller.retrySummary()}
          >
            Retry counts
          </Button>
        </div>
      {/if}

      {#if controller.attentionError}
        <div class="flex flex-wrap items-center gap-2" role="alert">
          <p class="text-destructive text-sm">{controller.attentionError}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={controller.attentionLoading}
            onclick={() => void controller.retryAttention()}
          >
            Retry attention
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</Card.Root>
