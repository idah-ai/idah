<script lang="ts">
  import { Button } from "@/components/ui/button";

  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  let { record, contexts }: { record: DatasetRecord; contexts?: { choose?: (record: DatasetRecord) => void } } =
    $props();
</script>

<Button
  variant="ghost"
  class="h-auto max-w-80 justify-start px-0 text-left text-xs [overflow-wrap:anywhere] whitespace-normal"
  onclick={() => contexts?.choose?.(record)}>{record.name}</Button
>
