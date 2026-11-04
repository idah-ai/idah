<script lang="ts">
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record, contexts }: { record: EntryRecord; contexts?: { datasetNames?: { [id: string]: string } } } = $props();
</script>

<span class="text-xs">{contexts?.datasetNames?.[record.dataset_id] ?? "Unavailable"}</span>
