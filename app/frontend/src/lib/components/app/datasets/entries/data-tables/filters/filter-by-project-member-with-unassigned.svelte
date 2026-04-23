<script lang="ts" generics="T extends Record">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import { CommandItem } from "@/components/ui/command";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { LabelValue } from "@/utils/types";
  import UnassignedAvartar from "./unassigned-avartar.svelte";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<T> = $props();

  // Contexts
  if (!contexts || !("projectId" in contexts)) {
    throw new Error("`projectId` is required in contexts for FilterByProjectMember");
  }

  let { projectId } = contexts as { projectId: string };

  // Variables
  const resource: string = ProjectMemberRecord.type;
  const filterKey: string = columnSetting.filterOptions?.filterKey || "project_member_id";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "eq";
  const filterKeyWithOperation: string = `${filterKey}__${filterOperation}`;

  let additionalChoices: LabelValue<string | number>[] = [
    {
      label: "Unassigned",
      value: "null",
    },
  ];

  // Functions
  function handleFilter(value: string | number | null): void {
    onFilter({
      filters: {
        [filterKeyWithOperation]: value === "null" ? null : value,
      },
    });
  }
</script>

<SingleSelectDatasourceField
  name="{resource}/project_member_id"
  dataSource={projectMembersBackendDataSource}
  listOptions={{
    filters: {
      project_id: projectId,
    },
  }}
  valueKey="account_id"
  displayKey="email"
  searchable
  searchKeyWithOperation="email__match"
  value={filters[filterKeyWithOperation] === null ? "null" : filters[filterKeyWithOperation]}
  {additionalChoices}
  onSelected={handleFilter}
>
  {#snippet slotTriggerValue({ selectedChoice })}
    {#if selectedChoice?.data}
      <AccountAvatar size="sm" email={selectedChoice.data["email"]} showEmail />
    {:else if selectedChoice && selectedChoice.value === "null"}
      <UnassignedAvartar class="size-6" />
    {:else}
      <span class="truncate">{selectedChoice?.label || filters[filterKeyWithOperation]}</span>
    {/if}
  {/snippet}

  {#snippet slotChoice({ choice, select })}
    {@const isSelected = filters[filterKeyWithOperation] === choice.value}
    <CommandItem
      class={cn("group cursor-pointer", {
        "bg-primary/10": isSelected,
      })}
      onclick={() => select(choice)}
    >
      {#if choice.data}
        <AccountAvatar
          name={choice.data["name"]}
          email={choice.data["email"]}
          showName
          showEmail
          size="sm"
          {isSelected}
        />
      {:else}
        <UnassignedAvartar isSelected={isSelected || filters[filterKeyWithOperation] === null} />
      {/if}
    </CommandItem>
  {/snippet}
</SingleSelectDatasourceField>
