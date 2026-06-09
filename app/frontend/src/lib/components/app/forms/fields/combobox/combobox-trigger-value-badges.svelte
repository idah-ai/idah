<script lang="ts">
  import { Badge } from "@/components/ui/badge";
  import { Spinner } from "@/components/ui/spinner";

  import { Record } from "@/data/model/Record";
  import { humanize, truncate } from "@/utils/string";

  import type { DataSource } from "@/data/DataSource";

  // Props
  interface Props {
    values: Array<string | number | null>;
    maxShown?: number;
    truncateLength?: number;
    dataSource?: DataSource<Record>;
    displayKey?: string;
  }
  let { values = $bindable([]), maxShown = 1, truncateLength = 30, dataSource, displayKey = "name" }: Props = $props();

  // Records
  let records: Record[];

  // Functions
  async function fetchData(): Promise<void> {
    if (!dataSource) throw new Error("dataSource is required");
    if (!values) return;

    const results = await Promise.all(values.map((v) => dataSource.get(String(v))));
    records = results.map((r) => r.data);
  }
</script>

<div class="flex w-full gap-1">
  {#if !dataSource}
    {#each values.slice(0, maxShown) as value, index (index)}
      <Badge>{humanize(truncate(String(value), truncateLength))}</Badge>
    {/each}

    {#if values.slice(maxShown).length}
      <Badge>+{values.slice(maxShown).length} more...</Badge>
    {/if}
  {/if}

  {#if dataSource}
    {#await fetchData()}
      <Spinner size="sm"></Spinner>
    {:then _}
      {#each records.slice(0, maxShown) as record, index (index)}
        <Badge>{humanize(truncate(record[displayKey], truncateLength))}</Badge>
      {/each}

      {#if records.length > maxShown}
        <Badge>+{records.length - maxShown} more...</Badge>
      {/if}
    {/await}
  {/if}
</div>