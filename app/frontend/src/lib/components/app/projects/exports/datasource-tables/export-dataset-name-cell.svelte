<script lang="ts">
  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import { Spinner } from "@/components/ui/spinner";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let datasetIds = $derived((exportRecord.job as unknown as SyncJobRecord).arguments.dataset_ids);

  // Functions
  async function loadDatasets() {
    return await datasetsBackendDataSource.list({
      fields: {
        [DatasetRecord.type]: ["id", "name"],
      },
      filters: {
        id: datasetIds,
      },
    });
  }
</script>

{#await loadDatasets()}
  <Spinner size="sm" />
{:then datasetsRes}
  {#each datasetsRes.data as datasetRecord (datasetRecord.id)}
    <p>{datasetRecord.name}</p>
  {/each}
{/await}
