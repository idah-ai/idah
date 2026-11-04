<script lang="ts">
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import type { LabelValue } from "@/utils/types";

  // Props
  let {
    onSelected,
    maxSelections,
  }: { maxSelections?: number; onSelected: (choices: LabelValue<string | number>[]) => void } = $props();
</script>

<MultipleSelectDatasourceField
  dataSource={datasetsBackendDataSource}
  displayKey="name"
  name="datasets"
  label="Datasets"
  values={[]}
  searchKeyWithOperation="name__match"
  {onSelected}
  {maxSelections}
>
  {#snippet slotSelectAll({ selectAll, allChoicesSelected })}
    <button onclick={() => selectAll(!allChoicesSelected)}>Select all</button>
  {/snippet}
</MultipleSelectDatasourceField>
