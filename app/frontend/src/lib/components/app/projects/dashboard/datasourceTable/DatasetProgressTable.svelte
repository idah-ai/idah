<script lang="ts">
  import type { CollectionResponse } from "@/data/model/types";
  import { untrack } from "svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import {
    isAccessError,
    type DatasetTableContexts,
    type ProjectDashboardDataSources,
  } from "@/data/model/dataset/projects/dashboard/record";
  import { datasetProgressColumns as columns } from "./dataset-progress.columns";
  let {
    sources,
    ids,
    choose,
    stateKey,
  }: {
    stateKey: string;
    sources: ProjectDashboardDataSources;
    ids: string[];
    choose: (record: DatasetRecord, page?: number | null) => void;
  } = $props();
  const source = untrack(() => sources.table(ids));
  const contextsByRows = new WeakMap<DatasetRecord[], Promise<DatasetTableContexts>>();
  async function onLoadSetContexts(response: CollectionResponse<DatasetRecord>): Promise<DatasetTableContexts> {
    while (true) {
      await source.synchronize(response);
      const rows = response.data;
      let pending = contextsByRows.get(rows);
      if (!pending) {
        pending = (async () => {
          const pairs = await Promise.all(
            rows.map(async (record) => {
              try {
                return [record.id, await sources.counts([record.id])] as const;
              } catch (error) {
                if (isAccessError(error)) throw error;
                return [record.id, null] as const;
              }
            }),
          );
          return {
            choose: (record: DatasetRecord) => choose(record, source.position(record.id, response)),
            countsByDataset: Object.fromEntries(pairs),
          };
        })();
        contextsByRows.set(rows, pending);
      }
      const contexts = await pending;
      await source.synchronize(response);
      if (response.data === rows) return contexts;
    }
  }
</script>

<DatasourceTable
  id={stateKey}
  name="dataset"
  refetchKey="datasets"
  {columns}
  dataSource={source}
  listOptions={{ sort: ["name"] }}
  {onLoadSetContexts}
/>
