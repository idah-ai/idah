<script lang="ts" generics="T extends Record">
  import { CheckIcon } from "@lucide/svelte";

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

  // Functions
  function handleFilter(value: string | number): void {
    onFilter({
      filters: {
        [filterKeyWithOperation]: value,
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
  displayKey="email"
  searchable
  searchKeyWithOperation="email__match"
  value={filters[filterKeyWithOperation]}
  onSelected={handleFilter}
>
  {#snippet slotChoice({ choice, select })}
    {#if choice.data}
      {@const isSelected = filters[filterKeyWithOperation] === choice.value}
      <CommandItem onclick={() => select(choice)}>
        <CheckIcon
          class={cn("size-4 opacity-0", {
            "opacity-100": isSelected,
          })}
        />

        <AccountAvatar name={choice.data["name"]} email={choice.data["email"]} showName showEmail size="sm" />
      </CommandItem>
    {/if}
  {/snippet}
</SingleSelectDatasourceField>
