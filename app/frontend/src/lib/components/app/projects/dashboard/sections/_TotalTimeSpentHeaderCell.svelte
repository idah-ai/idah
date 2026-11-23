<script lang="ts">
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { ArrowDownIcon, ArrowUpIcon } from "@lucide/svelte";

  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);

  const sortedDesc = $derived(
    controller.entryProgressSort.length > 0 && controller.entryProgressSort[0] === "-total_time_spent",
  );
</script>

<Button
  variant="ghost"
  size="sm"
  class="text-muted-foreground hover:text-foreground -mr-2 font-medium"
  onclick={() => controller.sortTotalTimeSpent()}
>
  Total time spent
  {#if controller.entryProgressSort[0]?.endsWith("total_time_spent")}
    <span class="ml-1">
      {#if sortedDesc}
        <ArrowDownIcon />
      {:else}
        <ArrowUpIcon />
      {/if}
    </span>
  {/if}
</Button>
