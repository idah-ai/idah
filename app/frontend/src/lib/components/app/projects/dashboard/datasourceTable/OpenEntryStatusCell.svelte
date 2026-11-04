<script lang="ts">
  import EntryStatusBadge from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<EntryStatusBadge entry={record} />
