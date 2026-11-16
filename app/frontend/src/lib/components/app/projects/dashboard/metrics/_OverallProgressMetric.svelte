<script lang="ts">
  import DatasetMetric from "@/components/app/projects/dashboard/metrics/_DatasetMetric.svelte";
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
  description={controller.summary
    ? `${controller.summary.completed.toLocaleString()} of ${controller.summary.total.toLocaleString()} completed`
    : ""}
/>
