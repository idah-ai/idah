<script lang="ts">
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<span
  class="text-muted-foreground text-xs"
  title="The time this status began is not recorded."
  aria-label={`Time in status unavailable for ${record.name || record.resource}`}>—</span
>
