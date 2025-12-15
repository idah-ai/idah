<script lang="ts">
  import Progress from "@/components/ui/progress/progress.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();

  // Variables
  let { progress } = $derived(dataset);
  let progressPercentage = $derived(Math.floor(progress * 100));
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-center gap-1">
    <Text size="xs" weight="semibold" class="text-primary">{progressPercentage}%</Text>
  </div>

  <Progress value={progressPercentage} />
</div>
