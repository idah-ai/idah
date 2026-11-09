<script lang="ts">
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<span
  title="Recorded time is not available yet."
  aria-label={"Total time spent unavailable for " + (record.name || record.resource)}>—</span
>
