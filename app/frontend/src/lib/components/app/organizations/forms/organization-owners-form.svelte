<script lang="ts">
  import { page } from "$app/state";
  import { CheckIcon, Trash2Icon, UserRoundIcon } from "@lucide/svelte";

  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { cn } from "@/utils";

  // Props
  interface Props {
    owners: Array<string>;
  }
  let { owners = $bindable() }: Props = $props();

  // Variables
  const organizationId = page.params.organizationId as string;
  const resource: string = AccountRecord.type;
  const maxShownSelection: number = 2;

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
      listOptions={{
        sort: ["email"],
      }}
      placeholder="Select accounts"
      searchKeyWithOperation="email__match"
      searchable
      searchPlaceholder="Search accounts by email"
      displayKey="email"
      clearable
      onSelected={(selectedChoices) => {
        owners = selectedChoices.map((choice) => String(choice.value));
        selectedAccounts = selectedChoices.map((choice) => ({ account: choice.data as AccountRecord }));
      }}
    >
      {#snippet slotTriggerValues({ selectedChoices })}
        <div class="flex flex-wrap items-center gap-1">
          {#each selectedChoices.slice(0, maxShownSelection) as selectedChoice (selectedChoice.value)}
            <Badge variant="outline" rounded="full">
              {selectedChoice.label}
            </Badge>
          {/each}

          {#if selectedChoices.slice(maxShownSelection).length > 0}
            <Badge variant="outline" rounded="full">
              +{selectedChoices.slice(maxShownSelection).length} more
            </Badge>
          {/if}
        </div>
      {/snippet}

      {#snippet slotChoice({ choice, select })}
        {@const isAlreadyAdded = choice.data
          ? (choice.data["role_scope"].org || []).includes(Number(organizationId))
          : false}
        <CommandItem disabled={isAlreadyAdded} onclick={() => select(choice)}>
          <CheckIcon
            class={cn("mr-2 size-4", {
              "opacity-0": !owners.find((owner) => owner == choice.value),
            })}
          />

          {choice.label}

          {#if isAlreadyAdded}
            <Badge variant="outline" rounded="full" class="ml-auto">Already added</Badge>
          {/if}
        </CommandItem>
      {/snippet}
    </MultipleSelectDatasourceField>

    <section class="flex max-h-80 flex-col gap-2 overflow-y-scroll pr-2">
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
