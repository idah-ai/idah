<script lang="ts">
  import { DownloadIcon } from "@lucide/svelte";
  import { format } from "date-fns";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { auditColumns } from "@/components/app/audit/audits/datasource-tables/audit-columns";
  import { getTablePreferences } from "@/components/app/datasource-table/datasource-table.stores.svelte";
  import { auditsBackendDataSource } from "@/data/model/audit/audits/record";
  import { refetches } from "@/utils/refetch";

  // Variables
  const auditDataSourceTableId: string = "audits";

  // Functions
  async function downloadAudits() {
    const auditDataSourceTable = getTablePreferences(auditDataSourceTableId);
    auditDataSourceTable.subscribe((preferences) => {
      console.log(preferences.filters);
    });
  }
</script>

{#key $refetches.audits.list}
  <DatasourceTable
    id={auditDataSourceTableId}
    name="audit"
    refetchKey="audits"
    columns={auditColumns}
    dataSource={auditsBackendDataSource}
  >
    {#snippet actions({ tablePreferences })}
      <Button variant="secondary" onclick={downloadAudits}>
        <DownloadIcon />

        Download

        {#if Object.keys(tablePreferences?.filters || {}).includes("timestamp__gte")}
          <span class="text-muted-foreground text-xs">
            (
            {format(tablePreferences?.filters["timestamp__gte"], "MMM dd, yyyy")} -
            {format(tablePreferences?.filters["timestamp__lte"], "MMM dd, yyyy")}
            )
          </span>
        {:else}
          All
        {/if}
      </Button>
    {/snippet}
  </DatasourceTable>
{/key}
