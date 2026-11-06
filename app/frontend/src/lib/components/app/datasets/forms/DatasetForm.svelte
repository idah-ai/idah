<script lang="ts">
  import { page } from "$app/state";
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MediaPicker from "@/components/app/datasets/upload/MediaPicker.svelte";
  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import Text from "@/components/ui/text/Text.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { Resource } from "@/security/types";

  // Props
  interface Props extends FormBaseProps {
    dataset: DatasetRecord;
    newRecord: boolean;
    // Create from folders/zips: datasets are named after them, so there is no name field.
    uploadMode?: boolean;
    canEditDeliveryDate: boolean;
  }
  let { dataset, newRecord, uploadMode = false, canEditDeliveryDate, fieldErrors, onValueChange }: Props = $props();

  // Variables
  const resource: Resource = "dataset:datasets";
  let projectId = $derived(page.params.projectId as string);
  let { name, modality, delivery_date } = $derived(dataset);
  let selectedDatasetId = $state<string | null>(null);
  let picked = $state<PickedFile[]>([]);
  let ignored = $state<PickedFile[]>([]);

  // Functions
  $effect(() => {
    onValueChange({
      name,
      modality,
      delivery_date,
      selectedDatasetId,
      picked,
      ignored,
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
    {#if !uploadMode}
      <InputField
        name="{resource}/name"
        label="Name"
        placeholder="Enter dataset name"
        required
        errors={fieldErrors["name"]}
        value={name}
        oninput={(e) => (name = e.currentTarget.value)}
      />
    {/if}

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

    {#key delivery_date}
      <DatePickerField
        name="{resource}/delivery_date"
        label="Delivery Date"
        placeholder="Select delivery date"
        errors={fieldErrors["delivery_date"]}
        value={delivery_date ? parseDate(delivery_date).toDate(getLocalTimeZone()) : null}
        minDate={today(getLocalTimeZone())}
        clearable={canEditDeliveryDate}
        disabled={!canEditDeliveryDate}
        onDateSelected={(selectedDate) => {
          delivery_date = selectedDate;
        }}
      />
    {/key}

    <!-- DATASET::LABELING CONFIGURATION -->
    {#key modality}
      <SingleSelectDatasourceField
        name="{resource}/labeling_configuration"
        label="Copy label configurations from"
        placeholder="Select a dataset"
        displayKey="name"
        valueKey="id"
        searchable
        clearable
        searchKeyWithOperation="name__match"
        hiddenChoices={dataset.id ? [dataset.id] : []}
        dataSource={datasetsBackendDataSource}
        listOptions={{
          filters: {
            project_id: projectId,
            modality,
          },
          sort: ["name"],
        }}
        disabled={!modality}
        value={selectedDatasetId}
        onSelected={(selectedValue) => {
          selectedDatasetId = selectedValue as string;
        }}
      ></SingleSelectDatasourceField>
    {/key}

    <!-- DATASET::MEDIA (create from upload) -->
    {#if uploadMode}
      <div>
        <MediaPicker class="py-8" mode="datasets" bind:picked bind:ignored />
        {#if fieldErrors["files"]}
          <Text class="text-destructive mt-2" size="sm">{fieldErrors["files"][0]}</Text>
        {/if}
      </div>
    {/if}
  </FieldGroup>
</FieldSet>
