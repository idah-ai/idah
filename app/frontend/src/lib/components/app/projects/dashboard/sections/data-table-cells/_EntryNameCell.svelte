<script lang="ts">
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { truncate } from "@/utils/string";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();
</script>

<Tooltips>
  {#snippet trigger()}
    <Text size="sm">{truncate(entry.name || entry.resource, 40)}</Text>
  {/snippet}
  {#snippet content()}
    <Text size="sm">{entry.name || entry.resource}</Text>
  {/snippet}
</Tooltips>
