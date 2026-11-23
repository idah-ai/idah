<script lang="ts">
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import Link from "@/components/ui/text/Link.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { truncate } from "@/utils/string";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";

  let { row: entry }: { row: EntryRecord } = $props();
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const truncateLength = 30;
  const datasetName = $derived(entry.dataset?.name);
</script>

{#if datasetName}
  <TooltipProvider>
    <Tooltip disabled={datasetName.length <= truncateLength}>
      <TooltipTrigger>
        {#snippet child({ props })}
          <Link
            {...props}
            href={`/projects/${controller.projectId}/datasets/${entry.dataset_id}/entries`}
            target="_blank"
            showIcon
          >
            <Text size="sm">{truncate(datasetName, truncateLength)}</Text>
          </Link>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent><Text size="sm">{datasetName}</Text></TooltipContent>
    </Tooltip>
  </TooltipProvider>
{:else}
  <Text size="sm">-</Text>
{/if}
