<script lang="ts">
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

  const tooltipId = $props.id();

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<TooltipProvider>
  <Tooltip delayDuration={200}>
    <TooltipTrigger>
      {#snippet child({ props })}
        <span {...props} aria-describedby={tooltipId} class="min-w-0 flex-1 truncate text-sm">
          {record.name || record.resource}
        </span>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent class="max-w-sm [overflow-wrap:anywhere] whitespace-normal">
      <span id={tooltipId} role="tooltip">{record.name || record.resource}</span>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
