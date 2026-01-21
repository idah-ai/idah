<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { SyncJobRecord } from "@/data/model/sync/jobs/record";

  let { record: syncJob }: DataTableCellBaseProps<SyncJobRecord> = $props();
</script>

<div>
  <div>
    format: {Object.entries(syncJob.arguments["formats"])
      .map(([k, v]) => k)
      .join(",")}
  </div>
  {#each Object.entries(syncJob.arguments["filters"]) as [filter, value]}
    <div>
      {filter}: {JSON.stringify(value)}
    </div>
  {/each}
</div>
