<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
</script>

<Button variant="link" class="px-0">{dataset.name}</Button>
