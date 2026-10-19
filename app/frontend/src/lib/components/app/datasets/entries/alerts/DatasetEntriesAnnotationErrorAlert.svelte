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

  async function getTotalErrorEntries(): Promise<EntryRecord[]> {
    const res = await entriesBackendDataSource.list({
      fields: {
        [EntryRecord.type]: ["id"], // Get only 'id' from filters to count entries.
      },
      filters: {
        dataset_id: datasetId,
        orphan_categories: true,
      },
    });

    return res.data;
  }
</script>

{#await getTotalErrorEntries() then orphanEntries}
  {@const totalErrorEntries = orphanEntries.length}
  {#if totalErrorEntries}
    <Alert.Root class="bg-destructive/10 border-destructive/50 text-destructive">
      <TriangleAlertIcon />

      <Alert.Description class=" text-destructive inline-flex text-sm">
        <strong>{totalErrorEntries} {pluralizeUnit(totalErrorEntries, "entry", "entries")}</strong>
        <span>have annotation errors.</span>
      </Alert.Description>

      <Alert.Action class="mt-1 flex items-center gap-2">
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
