<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MultipleSelectField from "@/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { apiKeyPermissions, scopeTypes } from "@/data/model/iam/api-keys/constants";
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    apiKey: ApiKeyRecord;
    newRecord?: boolean;
  }
  let { apiKey, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = ApiKeyRecord.type;

  // Variables::Reactive
  let { name, scope_type, permissions } = $derived(apiKey);

  // Functions
  $effect(() => {
    onValueChange({ name, scope_type, permissions });
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

    <!-- APIKEY:ROLE -->
    <!-- {#if !newRecord && account.role_name !== "org_owner"} -->
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
    <!-- {/if} -->

    <!-- APIKEY:ROLE -->
    <!-- {#if !newRecord && account.role_name !== "org_owner"} -->
    <MultipleSelectField
      name="{resource}/permission"
      label="Permissions"
      placeholder="Select permissions"
      required
      choices={apiKeyPermissions}
      errors={fieldErrors["permission"]}
      values={permissions}
    />
    <!-- {/if} -->
  </FieldGroup>
</FieldSet>
