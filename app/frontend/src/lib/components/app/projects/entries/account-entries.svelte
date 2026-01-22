<script lang="ts">
  import { onMount } from "svelte";

  import Link from "@/components/ui/text/Link.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props {
    accountId: number | string;
    projectId?: number | string;
  }

  // Variables
  let entries: EntryRecord[] = $state([]);
  let countEntriesByDataset: Record<string, number> = $state({});
  let nameDatasetMap: Record<string, string> = $state({});
  let { accountId, projectId }: Props = $props();

  // Functions
  async function fetchEntries(): Promise<void> {
    const filters = { assigned_to_id: accountId };

    if (projectId) {
      Object.assign(filters, { project_id: projectId });
    }

    entries = (
      await entriesBackendDataSource.list({
        fields: {
          [DatasetRecord.type]: ["name"],
          [EntryRecord.type]: ["resource", "project_id", "dataset_id", "assigned_to_id"],
        },
        filters: filters,
        included: ["dataset"],
      })
    ).data;

    countEntriesByDataset = entries.reduce(
      (acc, entry) => {
        const datasetId = entry.dataset_id;
        acc[datasetId] = (acc[datasetId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    nameDatasetMap = entries.reduce(
      (acc, entry) => {
        const datasetId = entry.dataset_id;
        acc[datasetId] = entry.dataset.name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Lifecycle
  onMount(async () => {
    await fetchEntries();
  });
</script>

{#if entries.length > 0}
  <div class="text-muted-foreground text-sm">
    <div>Entries on these datasets will be unassigned from this account.</div>
    <ul class="ml-5 mt-2 max-h-40 overflow-y-auto">
      {#each Object.entries(countEntriesByDataset) as [datasetId, count] (datasetId)}
        <li>
          <Link
            href={`/projects/${projectId}/datasets/${datasetId}/entries?filters[assigned_to_id]=${accountId}`}
            target="_blank"
          >
            {nameDatasetMap[datasetId]}
            ({count}
            {count === 1 ? "entry" : "entries"})
          </Link>
        </li>
      {/each}
    </ul>
  </div>
{/if}
