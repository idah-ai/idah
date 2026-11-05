<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record, contexts }: { record: EntryRecord; contexts?: { datasetNames?: { [id: string]: string } } } = $props();
</script>

<Text size="xs">{contexts?.datasetNames?.[record.dataset_id] ?? "Unavailable"}</Text>
