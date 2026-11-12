<script lang="ts">
  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();
</script>

<EntryStatus {entry} />
