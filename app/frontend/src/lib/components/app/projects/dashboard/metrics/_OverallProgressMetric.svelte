<script lang="ts">
  import DatasetMetric from "@/components/app/projects/dashboard/metrics/_DatasetMetric.svelte";
  import Progress from "@/components/ui/progress/progress.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<DatasetMetric
  order={2}
  title={controller.focused
    ? "Dataset progress"
    : controller.selectedDatasetIds.length
      ? "Progress of selection"
      : "Overall progress"}
  value={controller.progress === null ? "—" : `${controller.progress}%`}
>
  {#snippet SlotDescription()}
    <div class="space-y-1">
      {#if controller.progress !== null}
        <Progress value={controller.progress} class="bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-500" />
      {/if}
      {#if controller.summary}
        <Text size="sm" class="text-muted-foreground">
          {controller.summary.completed.toLocaleString()} of {controller.summary.total.toLocaleString()} completed
        </Text>
      {/if}
    </div>
  {/snippet}
</DatasetMetric>
