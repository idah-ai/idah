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
  order={3}
  title="Open entries"
  value={controller.openEntriesCount?.toLocaleString() ?? "—"}
  description={controller.openEntriesDescription}
/>
