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
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<Card.Root class="p-0">
  {#if controller.summaryError}
    <ResponseBlock title="Metric card unavailable" description="">
      {#snippet actions()}
        <Button variant="outline" size="sm" onclick={() => void controller.retrySummary()}>Retry counts</Button>
      {/snippet}
    </ResponseBlock>
  {:else if controller.attentionError}
    <ResponseBlock title="Metric card unavailable" description="">
      {#snippet actions()}
        <Button variant="outline" size="sm" onclick={() => void controller.retryAttention()}>Retry attention</Button>
      {/snippet}
    </ResponseBlock>
  {:else}
    <Card.Content class="grid p-0 md:grid-cols-4">
      <TotalEntriesMetric />
      <OverallProgressMetric />
      <OpenEntriesMetric />
      <DatasetNeedingAttentionMetric />
    </Card.Content>
  {/if}
</Card.Root>
