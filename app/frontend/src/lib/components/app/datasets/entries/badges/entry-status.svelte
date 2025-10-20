<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props {
    entry: EntryRecord;
  }
  let { entry }: Props = $props();
</script>

<Badge variant={entry.statusBadge.variant}>{entry.statusBadge.label}</Badge>
