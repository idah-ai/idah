<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
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
  let { name, description, organization_id } = $derived(project);

  // Functions
  $effect(() => {
    onValueChange({ name, description, organization_id });
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
      label="Organization"
      placeholder="Select an organization"
      dataSource={organizationsBackendDataSource}
      displayKey="name"
      required
      errors={fieldErrors["organization_id"]}
      value={organization_id}
      onSelected={(value: string | number) => {
        organization_id = value as number;
      }}
      searchKeyWithOperation="name__match"
    ></SingleSelectDatasourceField>

    <!-- PROJECT::DESCRIPTION -->
    <TextareaField
      name="{resource}/description"
      label="Description"
      placeholder="Enter project description"
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    ></TextareaField>
  </FieldGroup>
</FieldSet>
