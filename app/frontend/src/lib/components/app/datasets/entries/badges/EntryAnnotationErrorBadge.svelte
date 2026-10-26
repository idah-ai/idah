<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { pluralizeUnit } from "@/utils/unit";
  import { entryStatBackendDataSource, EntryStatRecord } from "@/data/model/dataset/entry-stats/record";
  import { refetches } from "@/utils/refetch";

  interface Props {
    entryId: string;
  }
  let { entryId }: Props = $props();

  async function getEntryStats() {
    const res = await entryStatBackendDataSource.list({
      fields: {
        [EntryStatRecord.type]: ["key", "value"],
      },
      filters: {
        entry_id: entryId,
        key: "orphan_category.count",
      },
      pagination: {
        page: 1,
        itemsPerPage: 1,
      },
      noCache: true,
    });

    return res.data[0];
  }
</script>

{#key $refetches.entryStats.list}
  {#await getEntryStats() then stat}
    {@const orphanCategoryCount = Number(stat.value)}

    {#if orphanCategoryCount > 0}
      <Badge variant="destructive-outline" rounded="full">
        <TriangleAlertIcon />
        {orphanCategoryCount}
        {pluralizeUnit(orphanCategoryCount, "annotation error")}
      </Badge>
    {/if}
  {/await}
{/key}
