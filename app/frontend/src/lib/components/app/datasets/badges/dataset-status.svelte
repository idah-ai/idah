<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    dataset: DatasetRecord;
  }
  let { dataset }: Props = $props();
</script>

<Badge variant={dataset.statusBadge.variant}>
  {dataset.statusBadge.label}
</Badge>
