<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import DatasetMetric from "@/components/app/projects/dashboard/metrics/_DatasetMetric.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";

  interface Props {
    onOpenEntries: () => void;
  }
  let { onOpenEntries }: Props = $props();

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<DatasetMetric
  order={3}
  title="Open entries"
  value={controller.openEntriesCount?.toLocaleString() ?? "-"}
  description={controller.openEntriesDescription}
>
  {#snippet SlotTitle()}
    <Button
      variant="link"
      class="text-muted-foreground h-auto justify-start p-0 font-normal"
      disabled={controller.denied || controller.loading || !controller.scopeReady}
      onclick={onOpenEntries}
    >
      Open entries
    </Button>
  {/snippet}
</DatasetMetric>
