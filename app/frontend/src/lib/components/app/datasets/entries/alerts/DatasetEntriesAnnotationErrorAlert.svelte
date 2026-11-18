<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import * as Alert from "$lib/components/ui/alert/index";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";

  import { pluralizeUnit } from "@/utils/unit";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import type { Resource } from "@/security/types";

  interface Props {
    datasetId: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }
  let { datasetId, checked, onCheckedChange }: Props = $props();

  const resource: Resource = "dataset:entries";

  async function getTotalErrorEntries(): Promise<number> {
    const res = await entriesBackendDataSource.list({
      fields: {
        [EntryRecord.type]: ["id"],
      },
      filters: {
        dataset_id: datasetId,
        orphan_categories: true,
      },
      count: true,
      pagination: { page: 1, itemsPerPage: 1 },
      noCache: true,
    });

    return res.meta?.count ?? 0;
  }
</script>

{#await getTotalErrorEntries() then totalErrorEntries}
  {#if totalErrorEntries > 0 || checked}
    <Alert.Root class="bg-destructive/10 border-destructive/50 text-destructive">
      <TriangleAlertIcon />

      <Alert.Description class=" text-destructive inline-flex text-sm">
        {#if totalErrorEntries > 0}
          <strong>{totalErrorEntries} {pluralizeUnit(totalErrorEntries, "entry has", "entries have")}</strong>
          <span>annotation errors.</span>
        {:else}
          <span>No entries currently have annotation errors.</span>
        {/if}
      </Alert.Description>

      <Alert.Action class="mt-1 flex items-center gap-2">
        <CheckboxField
          checkboxClass="border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive focus-visible:ring-destructive/50"
          name="{resource}/orphan_categories"
          label="Show only entries with errors"
          {checked}
          {onCheckedChange}
        />
      </Alert.Action>
    </Alert.Root>
  {/if}
{:catch}
  {#if checked}
    <Alert.Root class="bg-destructive/10 border-destructive/50 text-destructive">
      <TriangleAlertIcon />
      <Alert.Description>Could not load the annotation error count.</Alert.Description>
      <Alert.Action>
        <CheckboxField
          name="{resource}/orphan_categories"
          label="Show only entries with errors"
          {checked}
          {onCheckedChange}
        />
      </Alert.Action>
    </Alert.Root>
  {/if}
{/await}
