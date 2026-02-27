<script lang="ts">
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord, contexts }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let { datasets: datasetRecords } = contexts as { datasets: DatasetRecord[] };

  let datasetIds = $derived((exportRecord.job as unknown as SyncJobRecord).arguments.dataset_ids);
  let datasets = $derived(datasetRecords.filter((dataset) => datasetIds.includes(dataset.id)));
</script>

{#each datasets as dataset (dataset.id)}
  <p>{dataset.name}</p>
{/each}
