<script lang="ts">
  import Form from "@/components/app/forms/form.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    project: ProjectRecord;
  }
  let { project, onValueChange }: Props = $props();

  // Variables
  let resource = "project";

  // Variables::Reactive
  let name = $derived(project.name);
  let description = $derived(project.description);

  // Functions
  function handleInput(
    event: Event & {
      currentTarget: EventTarget & (HTMLInputElement | HTMLTextAreaElement);
    },
    key: string,
  ) {
    project[key] = event.currentTarget.value;
  }

  $effect(() => {
    onValueChange({ name, description });
  });
</script>

<Form>
  <!-- PROJECT::NAME -->
  <InputField name="{resource}/name" label="Name" placeholder="Enter project name" bind:value={name} />

  <!-- PROJECT::DESCRIPTION -->
  <TextareaField
    name="{resource}/description"
    label="Description"
    placeholder="Enter project description"
    bind:value={description}
  />
</Form>
