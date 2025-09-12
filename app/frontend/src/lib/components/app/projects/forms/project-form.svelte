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
  let { project, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = ProjectRecord.type;

  // Variables::Reactive
  let name = $derived(project.name);
  let description = $derived(project.description);

  // Functions
  $effect(() => {
    onValueChange({ name, description });
  });
</script>

<Form>
  <!-- PROJECT::NAME -->
  <InputField
    name="{resource}/name"
    label="Name"
    placeholder="Enter project name"
    required
    errors={fieldErrors["name"]}
    bind:value={name}
  ></InputField>

  <!-- PROJECT::DESCRIPTION -->
  <TextareaField
    name="{resource}/description"
    label="Description"
    placeholder="Enter project description"
    required
    errors={fieldErrors["description"]}
    bind:value={description}
  ></TextareaField>
</Form>
