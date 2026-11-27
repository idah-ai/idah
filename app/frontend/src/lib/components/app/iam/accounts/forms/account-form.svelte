<script lang="ts">
  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";
  import { CheckIcon } from "@lucide/svelte";
  import { CommandItem } from "@/components/ui/command";
  import { cn } from "@/utils";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { roles } from "@/data/model/iam/accounts/constants";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";
  import { canAssignAccountRole, filterAssignableAccountRoles } from "@/security/roleHierarchy";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { Role } from "@/data/model/iam/accounts/auth/constants";
  import type { LabelValue } from "@/utils/types";

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
  let { name, email, role_name, role_scope, enabled } = $derived(account);

  let currentAccount = $derived($authStatus.authContext);
  let actorOrgIds: string[] | undefined = $derived(
    currentAccount?.roleName === "org_owner" ? (currentAccount.roleScope?.org ?? []).map(String) : undefined,
  );
  let targetRole = $derived(account.role_name ?? "user");
  let editingSelf = $derived(!newRecord && currentAccount?.id === account.id);
  let canChangeRoleOrEnabled = $derived(
    !!currentAccount &&
      !editingSelf &&
      canAssignAccountRole(currentAccount.roleName, targetRole) &&
      !(currentAccount.roleName === "org_owner" && targetRole === "org_owner"),
  );
  let selectedOrgIds: string[] = $derived((role_scope?.org ?? []).map(String));
  let editableOrgIds = $derived(selectedOrgIds.filter((id) => !actorOrgIds || actorOrgIds.includes(id)));
  let hasForeignExistingScope = $derived(
    actorOrgIds !== undefined &&
      (account.role_scope?.org ?? []).some((id: string | number) => !actorOrgIds?.includes(String(id))),
  );

  // Filter the assignable roles by the actor's account role.
  $effect(() => {
    const currentAccount = $authStatus.authContext;
    if (!currentAccount) return;

    const allowed = filterAssignableAccountRoles(
      currentAccount.roleName,
      roles.map((r) => String(r.value)),
    );
    // IAM preserves out-of-scope IDs on update. A scoped actor cannot safely
    // promote a non-owner who still has an organization outside their reach.
    assignableRoles = roles.filter(
      (r) =>
        allowed.includes(String(r.value)) &&
        (r.value !== "org_owner" || newRecord || targetRole === "org_owner" || !hasForeignExistingScope),
    );
  });

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
      choices={assignableRoles}
      disabled={!newRecord && !canChangeRoleOrEnabled}
      errors={fieldErrors["role_name"]}
      value={role_name}
      onSelected={(selectedValue) => {
        if (role_name === selectedValue) return;
        role_scope = selectedValue === targetRole ? account.role_scope : { org: [] };
        role_name = selectedValue as Role;
      }}
    />
    <!-- {/if} -->

    {#if role_name === "org_owner" && !editingSelf && (!actorOrgIds || actorOrgIds.length > 0)}
      <MultipleSelectDatasourceField
        name="{resource}/role_scope"
        label="Organizations"
        placeholder="Select organizations"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        listOptions={actorOrgIds ? { filters: { id__in: actorOrgIds } } : undefined}
        searchKeyWithOperation="name__match"
        searchable
        required
        errors={fieldErrors["role_scope"]}
        values={editableOrgIds}
      >
        {#snippet slotChoice({ choice })}
          <CommandItem
            onclick={() => {
              const id = String(choice.value);
              role_scope = {
                org: selectedOrgIds.includes(id)
                  ? selectedOrgIds.filter((selectedId) => selectedId !== id)
                  : [...selectedOrgIds, id],
              };
            }}
          >
            <CheckIcon
              class={cn("mr-2 size-4", {
                "opacity-0": !selectedOrgIds.includes(String(choice.value)),
              })}
            />
            {choice.label}
          </CommandItem>
        {/snippet}
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

    <!-- ACCOUNT::ENABLED -->
    <CheckboxField
      name="{resource}/enabled"
      label="Enable account"
      info="Allow this account to access the application"
      bordered
      required
      errors={fieldErrors["enabled"]}
      disabled={!newRecord && !canChangeRoleOrEnabled}
      bind:checked={enabled}
    ></CheckboxField>

    {#if !newRecord && !enabled}
      <AccountEntries accountId={account.id} />
    {/if}
  </FieldGroup>
</FieldSet>
