<script lang="ts">
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
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

{#if entryNameIsTooLong}
  <Tooltips>
    {#snippet trigger()}
      <Text size="sm">{truncate(entryName, truncateLength)}</Text>
    {/snippet}
    {#snippet content()}
      <Text size="sm">{entryName}</Text>
    {/snippet}
  </Tooltips>
{:else}
  <Text size="sm">{entryName}</Text>
{/if}
