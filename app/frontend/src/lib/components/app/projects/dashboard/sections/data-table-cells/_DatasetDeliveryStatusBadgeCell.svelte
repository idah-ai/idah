<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
</script>

<Badge variant={dataset.deliveryStatusBadge.variant}>
  {dataset.deliveryStatusBadge.label}
</Badge>
