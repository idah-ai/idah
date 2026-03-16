<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MultipleSelectField from "@/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { apiKeyPermissions, scopeTypes } from "@/data/model/iam/api-keys/constants";
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";

  // Props
  interface Props extends FormBaseProps {
    apiKey: ApiKeyRecord;
    newRecord?: boolean;
  }
  let { apiKey, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = ApiKeyRecord.type;

  // Variables::Reactive
  let { name, scope_type, permissions, organizations, projects } = $derived(apiKey);

  // Functions
  $effect(() => {
    onValueChange({ name, scope_type, permissions, organizations });
  });
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- APIKEY::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="API Key Name"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />

    <!-- APIKEY:SCOPE_TYPE -->
    <SingleSelectField
      name="{resource}/scope_type"
      label="Scope Type"
      placeholder="Select scope"
      required
      choices={scopeTypes}
      errors={fieldErrors["scope_type"]}
      value={scope_type}
      onSelected={(selectedValue) => {
        scope_type = selectedValue as string;
      }}
    />

    <!-- APIKEY:ORGANIZATIONS -->
    {#if scope_type == "organization"}
      <MultipleSelectDatasourceField
        name="{resource}/organization_id"
        label="Organizations"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        values={organizations}
        placeholder="Select an organization"
        searchKeyWithOperation="name__match"
        clearable
        onSelected={(selectedChoices) => {
          organizations = selectedChoices.map((choice) => String(choice.value));
        }}
      />
    {/if}

    <!-- APIKEY:PROJECTS -->
    {#if scope_type == "project"}
      <MultipleSelectDatasourceField
        name="{resource}/project_id"
        label="Projects"
        dataSource={projectsBackendDataSource}
        displayKey="name"
        values={projects}
        placeholder="Select projects"
        searchKeyWithOperation="name__match"
        clearable
        onSelected={(selectedChoices) => {
          projects = selectedChoices.map((choice) => String(choice.value));
        }}
      />
    {/if}

    <!-- APIKEY:PERMISSIONS -->
    <MultipleSelectField
      name="{resource}/permission"
      label="Permissions"
      placeholder="Select permissions"
      required
      choices={apiKeyPermissions}
      errors={fieldErrors["permission"]}
      values={permissions}
    />

    <DatePickerField
      name="{resource}/expired_at"
      label="Expired At"
      placeholder="Select expiration date"
      errors={fieldErrors["expired_at"]}
      value={apiKey.expired_at}
    />
  </FieldGroup>
</FieldSet>
