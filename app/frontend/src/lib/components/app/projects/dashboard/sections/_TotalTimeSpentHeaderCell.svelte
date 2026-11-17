<script lang="ts">
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import Button from "@/components/ui/button/button.svelte";

  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<Button
  variant="ghost"
  size="sm"
  class="text-muted-foreground hover:text-foreground -mr-2 font-medium"
  onclick={() => controller.sortTotalTimeSpent()}
>
  Total time spent
  {#if controller.entryProgressSortKey === "total_time_spent"}
    <span class="ml-1">{controller.entryProgressSortDir === "asc" ? "↑" : "↓"}</span>
  {/if}
</Button>
