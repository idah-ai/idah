<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import MultipleSelectField from "@/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import { cn } from "@/utils";

  import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { scopeTypes } from "@/data/model/iam/api-keys/constants";
  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    apiKey: ApiKeyRecord;
  }
  let { apiKey, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = ApiKeyRecord.type;

  // Variables::Reactive
  let { name, scope_type, scope_value, permissions } = $derived(apiKey);

  // Functions
  async function loadPermissions(): Promise<void> {
    const permissionsRes = await apiKeysBackendDataSource.permission_list();
    console.log({ permissionsRes });

    return permissionsRes.data.map((permission) => ({
      label: permission.name,
      value: permission.id,
      description: permission.description,
      data: permission,
    }));
  }

  $effect(() => {
    onValueChange({ name, scope_type, scope_value, permissions });
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
        name="{resource}/scope_value/organizations"
        label="Organizations"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        values={scope_value}
        placeholder="Select an organization"
        searchKeyWithOperation="name__match"
        clearable
        required
        errors={fieldErrors["scope_value"]}
        onSelected={(selectedChoices) => {
          scope_value = selectedChoices.map((choice) => String(choice.value));
        }}
      />
    {/if}

    <!-- APIKEY:PROJECTS -->
    {#if scope_type == "project"}
      <MultipleSelectDatasourceField
        name="{resource}/scope_value/projects"
        label="Projects"
        dataSource={projectsBackendDataSource}
        displayKey="name"
        values={scope_value}
        placeholder="Select projects"
        searchKeyWithOperation="name__match"
        clearable
        required
        errors={fieldErrors["scope_value"]}
        onSelected={(selectedChoices) => {
          scope_value = selectedChoices.map((choice) => String(choice.value));
        }}
      />
    {/if}

    <!-- APIKEY:PERMISSIONS -->
    {#await loadPermissions() then permissionsChoices}
      <MultipleSelectField
        name="{resource}/permissions"
        label="Permissions"
        placeholder="Select permissions"
        required
        choices={permissionsChoices}
        errors={fieldErrors["permission"]}
        values={permissions}
      >
        {#snippet slotChoice({ choice, select })}
          {#if choice.data}
            <CommandItem class={cn("group cursor-pointer", {})} onclick={() => select(choice)}>
              <div>{choice.label}</div>
              <div>{choice.description}</div>
            </CommandItem>
          {/if}
        {/snippet}
      </MultipleSelectField>
    {/await}

    <DatePickerField
      name="{resource}/expired_at"
      label="Expired At"
      placeholder="Select expiration date"
      errors={fieldErrors["expired_at"]}
      value={apiKey.expired_at}
    />
  </FieldGroup>
</FieldSet>
