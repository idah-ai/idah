<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { onMount } from "svelte";

  interface Props {
    accountId: number | string;
  }

  let entries: EntryRecord[] = $state([]);
  let { accountId }: Props = $props();

  async function fetchEntries(): Promise<void> {
    entries = (
      await entriesBackendDataSource.list({
        filters: { assigned_to_id: accountId },
        fields: { "dataset:entries": ["resource"] },
      })
    ).data;
  }

  onMount(async () => {
    await fetchEntries();
  });
</script>

{#if entries.length > 0}
  <div class="text-muted-foreground text-sm">
    <div>Following entries({entries.length}) will be unassigned from this account.</div>
    <ul class="mt-2 ml-5 max-h-40 overflow-y-auto">
      {#each entries as entry (entry.id)}
        <li>
          <Link href={`/projects/${entry.project_id}/datasets/${entry.dataset_id}/entries`} target="_blank">
            {entry.resource}
          </Link>
        </li>
      {/each}
    </ul>
  </div>
{/if}
