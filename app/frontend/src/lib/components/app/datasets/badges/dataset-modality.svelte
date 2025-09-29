<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    dataset: DatasetRecord;
  }
  let { dataset }: Props = $props();
</script>

<Badge variant={dataset.modalityBadge.variant}>
  {@const Icon = dataset.modalityBadge.icon}

  <Icon class="mr-1 size-4"></Icon>
  {dataset.modalityBadge.label}
</Badge>
