<script lang="ts">
  import { Trash2Icon, UserRoundIcon } from "@lucide/svelte";

  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  // Props
  interface Props {
    owners: Array<string>;
  }
  let { owners = $bindable() }: Props = $props();

  // Variables
  const resource: string = AccountRecord.type;

  let selectedAccounts: { account: AccountRecord }[] = $state([]);

  // Functions
  function removeSelectedOwner(accountId: string) {
    owners = owners.filter((id) => id !== accountId);
    selectedAccounts = selectedAccounts.filter((item) => item.account.id !== accountId);
  }
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <MultipleSelectDatasourceField
      name="{resource}/owner"
      values={owners}
      dataSource={accountsBackendDataSource}
      placeholder="Select owners"
      searchKeyWithOperation="email__match"
      searchable
      searchPlaceholder="Search owners by email"
      displayKey="email"
      clearable
      onSelected={(selectedChoices) => {
        owners = selectedChoices.map((choice) => String(choice.value));
        selectedAccounts = selectedChoices.map((choice) => ({ account: choice.data as AccountRecord }));
      }}
    >
      {#snippet slotTriggerValues({ selectedChoices })}
        <div class="flex flex-wrap items-center gap-1">
          {#each selectedChoices as selectedChoice (selectedChoice.value)}
            <Badge variant="outline" rounded="full">
              {selectedChoice.label}
            </Badge>
          {/each}
        </div>
      {/snippet}
    </MultipleSelectDatasourceField>

    <section class="flex flex-col gap-2">
      {#each selectedAccounts as selectedAccount (selectedAccount)}
        {@const { id, email } = selectedAccount.account}
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <UserRoundIcon />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{email}</ItemTitle>
          </ItemContent>

          <ItemActions>
            <Button variant="ghost" size="icon-sm" onclick={() => removeSelectedOwner(id)}>
              <Trash2Icon />
            </Button>
          </ItemActions>
        </Item>
      {/each}
    </section>
  </FieldGroup>
</FieldSet>
