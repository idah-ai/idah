<script lang="ts">
  import { page } from "$app/state";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { Resource } from "@/security/types";

  // Props
  interface Props extends FormBaseProps {
    dataset: DatasetRecord;
    newRecord: boolean;
  }
  let { dataset, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  const resource: Resource = "dataset:datasets";
  let projectId = $derived(page.params.projectId as string);
  let { name, modality } = $derived(dataset);
  let selectedDatasetId = $state<string | null>(null);

  // Functions
  $effect(() => {
    onValueChange({
      name,
      modality,
      selectedDatasetId,
    });
  });

  async function loadModalities() {
    const modalitiesRes = await pluginsBackendDataSource.modalities();
    return modalitiesRes.modalities;
  }
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- DATASET::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="Enter dataset name"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />

    <!-- DATASET::MODALITY -->
    {#await loadModalities() then modalities}
      <SingleSelectField
        name="{resource}/modality"
        label="Modality"
        placeholder="Select modality"
        choices={Object.entries(modalities).map(([key, value]) => ({
          label: value.label,
          value: key,
        }))}
        required={newRecord}
        disabled={!newRecord}
        errors={fieldErrors["modality"]}
        value={modality}
        onSelected={(selectedValue) => {
          modality = selectedValue as string;
        }}
      />
    {/await}

    <!-- DATASET::LABELING CONFIGURATION -->
    <SingleSelectDatasourceField
      name="{resource}/labeling_configuration"
      label="Copy label configurations from"
      placeholder="Select a dataset"
      displayKey="name"
      valueKey="id"
      searchable
      searchKeyWithOperation="name__match"
      dataSource={datasetsBackendDataSource}
      listOptions={{
        filters: {
          project_id: projectId,
        },
        sort: ["name"],
      }}
      value={selectedDatasetId}
      onSelected={(selectedValue) => {
        selectedDatasetId = selectedValue as string;
      }}
    ></SingleSelectDatasourceField>
  </FieldGroup>
</FieldSet>
