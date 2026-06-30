<script lang="ts" generics="T extends Record">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import { CommandItem } from "@/components/ui/command";
  import UnassignedAvartar from "@/components/app/datasets/entries/data-tables/filters/unassigned-avartar.svelte";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { LabelValue } from "@/utils/types";

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

  // `assigned` may arrive as boolean `false` (live) or the string `"false"` (restored from the
  // URL, which stringifies every value), so compare loosely on the stringified form.
  let filtersValue: string | number | null = $derived(
    filters[filterKeyWithOperation] || (String(filters["assigned"]) === "false" ? "null" : null),
  );

  let additionalChoices: LabelValue<string | number>[] = [
    {
      label: "Unassigned",
      value: "null",
    },
  ];

  // Functions
  function handleFilter(value: string | number | null): void {
    switch (value) {
      case "null":
        // Unassigned: send `assigned: false`, clear the member id.
        // Emit `undefined` (not `delete`) so the table's filter handler removes it from prefs + URL.
        filters = { ...filters, [filterKeyWithOperation]: undefined, assigned: false };
        break;
      default:
        // Member: send the member id, clear `assigned: false`.
        filters = { ...filters, assigned: undefined, [filterKeyWithOperation]: value };
    }

    filtersValue = value;
    onFilter({
      filters,
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
  value={filtersValue}
  {additionalChoices}
  onSelected={handleFilter}
>
  {#snippet slotTriggerValue({ selectedChoice })}
    {#if selectedChoice?.data}
      <AccountAvatar size="sm" email={selectedChoice.data["email"]} showEmail />
    {:else if selectedChoice && selectedChoice.value === "null"}
      <UnassignedAvartar class="size-6" />
    {:else}
      <span class="truncate">{selectedChoice?.label || filtersValue}</span>
    {/if}
  {/snippet}

  {#snippet slotChoice({ choice, select })}
    <!-- Compare stringified: a member id restored from the URL is a string ("123") but the
         choice value is a number (123); `!= null` keeps "nothing selected" unhighlighted. -->
    {@const isSelected = filtersValue != null && String(filtersValue) === String(choice.value)}
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
        <UnassignedAvartar isSelected={isSelected || filtersValue === "null"} />
      {/if}
    </CommandItem>
  {/snippet}
</SingleSelectDatasourceField>
