<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    dataset: DatasetRecord;
    newRecord: boolean;
  }
  let { dataset, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource = "dataset";

  // Variables::Reactive
  let name = $derived(dataset.name);
  let modality = $derived(dataset.modality || "");

  // Functions
  $effect(() => {
    onValueChange({
      name,
      modality,
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
  </FieldGroup>
</FieldSet>
