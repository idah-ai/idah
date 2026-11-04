<script lang="ts">
  import { untrack } from "svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import type { CollectionResponse } from "@/data/model/types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import type { ProjectDashboardDataSources } from "@/data/model/dataset/projects/dashboard/record";
  import { openEntryColumns } from "./open-entry.columns";
  let { sources, ids, combined }: { sources: ProjectDashboardDataSources; ids: string[]; combined: boolean } = $props();
  const uid = $props.id();
  const dataSource = untrack(() => sources.openEntries(ids));
  const columns = untrack(() => ({
    ...openEntryColumns,
    dataset_id: { ...openEntryColumns.dataset_id, visible: combined },
  }));
  async function onLoadSetContexts(response: CollectionResponse<EntryRecord>) {
    if (!combined || !response.data.length) return {};
    const result = await sources.datasets.list({
      filters: { id: [...new Set(response.data.map((record) => record.dataset_id))] },
      pagination: { page: 1, itemsPerPage: response.data.length },
      count: false,
    });
    return { datasetNames: Object.fromEntries(result.data.map((record) => [record.id, record.name])) };
  }
</script>

<DatasourceTable
  id={`open-entries-${uid}`}
  name="open entry"
  refetchKey="entries"
  {columns}
  {dataSource}
  {onLoadSetContexts}
/>
