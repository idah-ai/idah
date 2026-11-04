<script lang="ts">
  import { untrack } from "svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import type { ProjectDashboardDataSources } from "@/components/app/projects/dashboard/DashboardData";
  import { openEntryColumns } from "./open-entry.columns";
  let {
    sources,
    ids,
    combined,
    stateKey,
  }: { sources: ProjectDashboardDataSources; ids: string[]; combined: boolean; stateKey: string } = $props();
  const dataSource = untrack(() => sources.openEntries(ids, combined));
  const columns = untrack(() => ({
    ...openEntryColumns,
    dataset_id: { ...openEntryColumns.dataset_id, visible: combined },
  }));
</script>

<DatasourceTable
  id={stateKey}
  name="open entry"
  refetchKey="entries"
  {columns}
  {dataSource}
  onLoadSetContexts={async (response) => dataSource.contexts(response)}
/>
