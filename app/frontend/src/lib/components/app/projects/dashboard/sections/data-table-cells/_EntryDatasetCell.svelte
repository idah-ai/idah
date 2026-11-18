<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();
</script>

<Text size="sm">{entry.dataset?.name ?? "—"}</Text>
