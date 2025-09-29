<script lang="ts">
  import Form from "@/components/app/forms/form.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    dataset: DatasetRecord;
  }
  let { dataset, onValueChange }: Props = $props();

  // Variables
  let resource = "dataset";

  // Variables::Reactive
  let name = $derived(dataset.name);
  let modality = $derived(dataset.modality || "");

  // Options for select fields
  const modalityOptions = [
    { value: "image", label: "Image" },
    { value: "video", label: "Video" },
    // { value: "text", label: "Text" },
    // { value: "audio", label: "Audio" },
  ];

  // Functions
  $effect(() => {
    onValueChange({
      name,
      modality,
    });
  });
</script>

<Form>
  <!-- DATASET::NAME -->
  <InputField
    name="{resource}/name"
    label="Name"
    placeholder="Enter dataset name"
    required
    errors={dataset.errors?.["name"]}
    bind:value={name}
  />

  <!-- DATASET::MODALITY -->
  <SingleSelectField
    name="{resource}/modality"
    label="Modality"
    placeholder="Select modality"
    choices={modalityOptions}
    required
    errors={dataset.errors?.["modality"]}
    bind:value={modality}
  />
</Form>
