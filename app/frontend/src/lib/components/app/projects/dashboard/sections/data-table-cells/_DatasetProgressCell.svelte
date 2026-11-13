<script lang="ts">
  import Progress from "@/components/ui/progress/progress.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { PROJECT_DASHBOARD_WORKFLOW_GROUPS } from "@/components/app/projects/dashboard/project-dashboard.constants";

  // Props
  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();

  // Variables
  const completedColor = PROJECT_DASHBOARD_WORKFLOW_GROUPS.find((group) => group.key === "completed")?.bgColor;
  const percentage = $derived.by((): number | null => {
    const total = dataset.entries_total_count;
    const completed = dataset.entries_completed_count;
    if (
      !Number.isSafeInteger(total) ||
      !Number.isSafeInteger(completed) ||
      total < 0 ||
      completed < 0 ||
      completed > total
    )
      return null;
    return total ? Math.floor((completed / total) * 100) : 0;
  });
</script>

{#if percentage === null}
  <span>—</span>
{:else}
  <div class="min-w-32 space-y-1">
    <Progress value={percentage} indicatorClass={completedColor} class="bg-muted" />

    <div class="flex w-full items-center justify-between gap-2">
      <Text size="xs" class="text-muted-foreground">
        {dataset.entries_completed_count.toLocaleString()} of {dataset.entries_total_count.toLocaleString()} completed
      </Text>

      <Text size="xs" weight="semibold">{percentage}%</Text>
    </div>
  </div>
{/if}
