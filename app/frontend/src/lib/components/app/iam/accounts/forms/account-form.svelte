<script lang="ts">
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { roles } from "@/data/model/iam/accounts/constants";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { filterAssignableAccountRoles } from "@/security/roleHierarchy";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { LabelValue } from "@/utils/types";
  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";

  // Props
  interface Props extends FormBaseProps {
    account: AccountRecord;
    newRecord?: boolean;
  }
  let { account, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = AccountRecord.type;
  let assignableRoles: Array<LabelValue<string | number>> = $state(roles);

  // Variables::Reactive
  let { name, email, role_name, enabled } = $derived(account);

  // Filter the assignable roles by the actor's account role.
  $effect(() => {
    const currentAccount = $authStatus.authContext;
    if (!currentAccount) return;

    const allowed = filterAssignableAccountRoles(
      currentAccount.roleName,
      roles.map((r) => String(r.value)),
    );
    assignableRoles = roles.filter((r) => allowed.includes(String(r.value)));
  });

  // Functions
  $effect(() => {
    onValueChange({ name, email, role_name, enabled });
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
      choices={assignableRoles}
      errors={fieldErrors["role_name"]}
      value={role_name}
      onSelected={(selectedValue) => {
        role_name = selectedValue as string;
      }}
    />
    <!-- {/if} -->

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
