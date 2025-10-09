<script lang="ts">
  import Progress from "@/components/ui/progress/progress.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();

  let entriesRes = dataset._jsonapiData.relationships?.["entries"];
  let entries = (entriesRes?.data as EntryRecord[]) || [];
  let completedEntries = entries.filter((entry) => entry.status === "completed");
  let totalEntries = entries.length;
  let totalProgress = $derived(totalEntries > 0 ? (completedEntries.length / totalEntries) * 100 : 0);
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-center gap-1">
    <Text size="xs" weight="semibold" class="text-primary">{totalProgress}%</Text>
    <Text size="xs" class="text-muted-foreground">({completedEntries.length} of {totalEntries})</Text>
  </div>

  <Progress value={dataset.progress}></Progress>
</div>
