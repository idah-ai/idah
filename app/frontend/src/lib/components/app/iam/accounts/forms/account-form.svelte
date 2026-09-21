<script lang="ts">
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { roles } from "@/data/model/iam/accounts/constants";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    account: AccountRecord;
    newRecord?: boolean;
  }
  let { account, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = AccountRecord.type;

  // Variables::Reactive
  let { name, email, role_name, role_scope, enabled } = $derived(account);

  // Functions
  $effect(() => {
    onValueChange({ name, email, role_name, role_scope, enabled });
  });
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- ACCOUNT::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="E.g. John Doe"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />

    <!-- ACCOUNT::EMAIL -->
    <InputField
      name="{resource}/email"
      label="Email"
      placeholder="E.g. john.doe@example.com"
      type="email"
      required
      disabled={!newRecord}
      errors={fieldErrors["email"]}
      value={email}
      oninput={(e) => (email = e.currentTarget.value)}
    />

    <!-- ACCOUNT:ROLE -->
    <!-- {#if !newRecord && account.role_name !== "org_owner"} -->
    <SingleSelectField
      name="{resource}/role_name"
      label="Role"
      placeholder="Select a role"
      required
      choices={roles}
      errors={fieldErrors["role_name"]}
      value={role_name}
      onSelected={(selectedValue) => {
        role_name = selectedValue as string;
      }}
    />
    <!-- {/if} -->

    {#if role_name === "org_owner"}
      <MultipleSelectDatasourceField
        name="{resource}/role_scope"
        label="Organization scopes"
        placeholder="Select organization scopes"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        searchKeyWithOperation="id"
        errors={fieldErrors["role_scope"]}
        values={role_scope?.org ?? []}
        onSelected={(selectedValues) => {
          role_scope = {
            org: selectedValues.map((item) => item.value),
          };
        }}
      />
    {/if}

    <!-- ACCOUNT::ENABLED -->
    <CheckboxField
      name="{resource}/enabled"
      label="Enable account"
      info="Allow this account to access the application"
      bordered
      required
      errors={fieldErrors["enabled"]}
      bind:checked={enabled}
    ></CheckboxField>

    {#if !newRecord && !enabled}
      <AccountEntries accountId={account.id} />
    {/if}
  </FieldGroup>
</FieldSet>
