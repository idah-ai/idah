<script lang="ts">
  import { page } from "$app/state";

  import { acceptedFileTypes } from "@/components/app/datasets/entries/overlays/upload-pipeline";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import PreviewUploadMediaItem from "@/components/app/datasets/entries/overlays/_PreviewUploadMediaItem.svelte";
  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import { mergePickedFiles } from "@/components/app/forms/fields/upload/file-upload.utils";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
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
  // Create-only: upload a folder/zip and create the dataset's entries from it in one go.
  let uploadNow = $state(false);
  let picked = $state<PickedFile[]>([]);

  // Functions
  $effect(() => {
    onValueChange({
      name,
      modality,
      selectedDatasetId,
      uploadNow,
      picked,
    });
  });

  // "clip_a/0001.jpg" -> "clip_a"; "batch.zip" -> "batch"; a loose media file suggests nothing.
  function suggestedName(first: PickedFile): string | null {
    if (first.path.includes("/")) return first.path.split("/")[0];
    if (first.path.toLowerCase().endsWith(".zip")) return first.path.slice(0, -".zip".length);
    return null;
  }

  function handleFilesSelected(selected: PickedFile[]): void {
    picked = mergePickedFiles(picked, selected);
    if (!name) name = suggestedName(selected[0]) ?? name;
  }

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
          picked = []; // accepted file types depend on the modality
        }}
      />
    {/await}

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

    <!-- DATASET::UPLOAD MEDIA NOW (create only) -->
    {#if newRecord}
      <CheckboxField
        name="{resource}/upload_now"
        label="Upload media now"
        info="Create the dataset's entries from a folder or zip archive"
        bordered
        disabled={!modality}
        errors={fieldErrors["files"]}
        bind:checked={uploadNow}
      ></CheckboxField>

      {#if uploadNow && modality}
        <FileUpload
          class="py-8"
          acceptedFileTypes={acceptedFileTypes(modality)}
          allowFolders
          onFilesSelected={handleFilesSelected}
        />

        {#if picked.length > 0}
          <section class="flex h-auto max-h-80 flex-col gap-4 overflow-y-auto pr-1">
            {#each picked as file, index (index)}
              <PreviewUploadMediaItem
                name={file.path}
                onDelete={() => (picked = picked.filter((_, i) => i !== index))}
              />
            {/each}
          </section>
        {/if}
      {/if}
    {/if}
  </FieldGroup>
</FieldSet>
