<script lang="ts">
  import { cn } from "@/utils";
  import { getLocalTimeZone, today } from "@internationalized/date";
  import { CheckIcon } from "@lucide/svelte";
  import { isBefore, startOfDay } from "date-fns";

  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import MultipleSelectField from "@/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { adminsScopeTypes, orgOwnersScopeTypes } from "@/data/model/iam/api-keys/constants";
  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends FormBaseProps {
    apiKey: ApiKeyRecord;
    newRecord?: boolean;
  }
  let { apiKey, fieldErrors, onValueChange, newRecord }: Props = $props();

  // Variables
  const resource: string = ApiKeyRecord.type;
  const currentAccount = $authStatus.authContext;

  // Variables::Reactive
  let { name, scope_type, scope_value, permissions, expires_at, status } = $derived(apiKey);

  // Functions
  async function loadPermissions(): Promise<Array<LabelValue<string | number>>> {
    const permissionsRes = await apiKeysBackendDataSource.permission_list({
      scope_type,
    });

    return permissionsRes.data.map((permission) => ({
      label: permission.attributes.title,
      value: permission.id,
      description: permission.attributes.description,
    }));
  }

  $effect(() => {
    onValueChange({ name, scope_type, scope_value, permissions, expires_at });
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
    {#if newRecord}
      <SingleSelectField
        name="{resource}/scope_type"
        label="Scope Type"
        placeholder="Select scope"
        required
        choices={currentAccount?.isRole("admin") ? adminsScopeTypes : orgOwnersScopeTypes}
        errors={fieldErrors["scope_type"]}
        value={scope_type}
        disabled={!newRecord}
        onSelected={(selectedValue) => {
          scope_type = selectedValue as string;
        }}
      />

      <!-- APIKEY:ORGANIZATIONS -->
      {#if scope_type == "org"}
        <MultipleSelectDatasourceField
          name="{resource}/scope_value/organizations"
          label="Organizations"
          dataSource={organizationsBackendDataSource}
          displayKey="name"
          values={scope_value}
          placeholder="Select organizations"
          searchKeyWithOperation="name__match"
          clearable
          required
          disabled={!newRecord}
          errors={fieldErrors["scope_value"]}
          onSelected={(selectedChoices) => {
            scope_value = selectedChoices.map((choice) => String(choice.value));
          }}
        >
          {#snippet slotTriggerValues({ selectedChoices })}
            <ComboboxTriggerValueBadges
              values={selectedChoices.map((choice) => choice.value)}
              dataSource={organizationsBackendDataSource}
              displayKey="name"
              maxShown={2}
            />
          {/snippet}
        </MultipleSelectDatasourceField>
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
          disabled={!newRecord}
          errors={fieldErrors["scope_value"]}
          onSelected={(selectedChoices) => {
            scope_value = selectedChoices.map((choice) => String(choice.value));
          }}
        >
          {#snippet slotTriggerValues({ selectedChoices })}
            <ComboboxTriggerValueBadges
              values={selectedChoices.map((choice) => choice.value)}
              dataSource={projectsBackendDataSource}
              displayKey="name"
              maxShown={2}
            />
          {/snippet}
        </MultipleSelectDatasourceField>
      {/if}

      <!-- APIKEY:PERMISSIONS -->
      {#await loadPermissions() then choices}
        <MultipleSelectField
          name="{resource}/permissions"
          label="Permissions"
          placeholder="Select permissions"
          required
          {choices}
          clearable
          disabled={!newRecord}
          errors={fieldErrors["permissions"]}
          values={permissions}
          onSelected={(selectedChoices) => {
            permissions = selectedChoices.map((choice) => String(choice.value));
          }}
        >
          {#snippet slotTriggerValues({ selectedChoices })}
            <ComboboxTriggerValueBadges values={selectedChoices.map((choice) => choice.label)} />
          {/snippet}

          {#snippet slotChoice({ choice, select })}
            {@const { label, description, value } = choice}
            <CommandItem value={String(value)} onSelect={() => select(choice)}>
              <CheckIcon
                class={cn("mr-2 size-4", {
                  "opacity-0": !permissions.find((v) => v == choice.value),
                })}
              />
              <div class="flex flex-col gap-0">
                <p>{label}</p>
                <small class="text-muted-foreground">{description}</small>
              </div>
            </CommandItem>
          {/snippet}
        </MultipleSelectField>
      {/await}
    {/if}

    <DatePickerField
      name="{resource}/expires_at"
      label="Expired At"
      placeholder="Select expiration date"
      errors={fieldErrors["expires_at"]}
      value={expires_at}
      minDate={today(getLocalTimeZone()).add({ days: 1 })}
      disabled={status === "revoked" ||
        (expires_at !== null && isBefore(startOfDay(expires_at), startOfDay(new Date())))}
      onDateSelected={(selectedDate) => {
        expires_at = selectedDate ? new Date(selectedDate) : null;
      }}
    />
  </FieldGroup>
</FieldSet>
