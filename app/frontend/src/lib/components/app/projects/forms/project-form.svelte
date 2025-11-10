<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { organizationsBackendDataSource } from "@/data/model/dataset/organizations/record";
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
  let organizationId = $derived(project.organization_id);

  // Functions
  $effect(() => {
    onValueChange({ name, description, organizationId });
  });
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- PROJECT::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="Enter project name"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    ></InputField>

    <!-- PROJECT::ORGANIZATION -->
    <SingleSelectDatasourceField
      name="{resource}/organization_id"
      label="Member"
      placeholder="Select a member"
      displayKey="email"
      dataSource={organizationsBackendDataSource}
      value={organizationId}
      searchKeyWithOperation="name__match"
      onValueChange={(value: string | number) => {
        organizationId = value as number;
      }}
    ></SingleSelectDatasourceField>

    <!-- PROJECT::DESCRIPTION -->
    <TextareaField
      name="{resource}/description"
      label="Description"
      placeholder="Enter project description"
      required
      errors={fieldErrors["description"]}
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    ></TextareaField>
  </FieldGroup>
</FieldSet>
