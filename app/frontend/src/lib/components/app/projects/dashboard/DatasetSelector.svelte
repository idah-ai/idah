<script lang="ts">
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  // Props
  let {
    projectId,
    ids,
    select,
  }: {
    projectId: string;
    ids: string[];
    select: (ids: string[]) => void;
  } = $props();
</script>

<MultipleSelectDatasourceField
  name="dashboard-datasets"
  label="Datasets"
  class="w-64 max-w-full min-w-0"
  dataSource={datasetsBackendDataSource}
  displayKey="name"
  values={ids}
  listOptions={{ filters: { project_id: projectId }, sort: ["name", "id"], noCache: true }}
  searchKeyWithOperation="name__match"
  searchable
  searchPlaceholder="Find a dataset…"
  placeholder="All datasets"
  clearable
  maxSelections={100}
  onSelected={(choices) => select(choices.map((choice) => String(choice.value)))}
>
  {#snippet slotTriggerValues({ selectedChoices })}
    <Text size="sm">
      {ids.length === 1 ? selectedChoices[0]?.label : `${ids.length} datasets selected`}
    </Text>
  {/snippet}
</MultipleSelectDatasourceField>
