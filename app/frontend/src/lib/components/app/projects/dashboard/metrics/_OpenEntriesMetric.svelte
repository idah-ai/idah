<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
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

<DatasetMetric order={3} title="Open entries" value={controller.openEntriesCount?.toLocaleString() ?? "-"}>
  {#snippet SlotDescription()}
    {#if controller.openEntriesDescription}
      <Text size="sm" class="text-muted-foreground">{controller.openEntriesDescription}</Text>
    {/if}

    <div class="mt-3 flex justify-end">
      <Button
        variant="link"
        class="h-auto p-0 text-xs font-normal underline-offset-4 hover:underline"
        disabled={controller.denied || controller.loading || !controller.scopeReady}
        onclick={onOpenEntries}
      >
        View open entries ↓
      </Button>
    </div>
  {/snippet}
</DatasetMetric>
