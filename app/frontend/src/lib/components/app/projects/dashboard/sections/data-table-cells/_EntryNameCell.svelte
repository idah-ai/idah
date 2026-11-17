<script lang="ts">
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { truncate } from "@/utils/string";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();

  // Variables
  const truncateLength = 40;
  const entryName = $derived(entry.name || entry.resource);
  const entryNameIsTooLong = $derived(entryName.length > truncateLength);
</script>

<TooltipProvider>
  <Tooltip disabled={!entryNameIsTooLong}>
    <TooltipTrigger>
      <Text size="sm">{truncate(entryName, truncateLength)}</Text>
    </TooltipTrigger>
    <TooltipContent><Text size="sm">{entryName}</Text></TooltipContent>
  </Tooltip>
</TooltipProvider>
