<script lang="ts">
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import { Badge } from "@/components/ui/badge";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  // Props
  interface Props {
    owners: Array<string>;
  }
  let { owners = $bindable() }: Props = $props();

  // Variables
  const resource: string = AccountRecord.type;

  let selectedAccounts = $state([]);
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <MultipleSelectDatasourceField
      name="{resource}/owner"
      values={selectedAccounts}
      dataSource={accountsBackendDataSource}
      placeholder="Select owners"
      searchKeyWithOperation="email__match"
      searchable
      searchPlaceholder="Search owners by email"
      displayKey="email"
      clearable
      onSelected={(selected) => {
        owners.push(String(selected));
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
  </FieldGroup>
</FieldSet>
