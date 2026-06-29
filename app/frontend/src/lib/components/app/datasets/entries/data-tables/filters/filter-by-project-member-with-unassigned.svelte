<script lang="ts" generics="T extends Record">
  import AssignedToEmailFilter from "@/components/app/datasets/entries/data-tables/filters/assigned-to-email-filter.svelte";

  import { Record } from "@/data/model/Record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<T> = $props();

  // Filter key → assigned_to_email__match
  const filterKey: string = columnSetting.filterOptions?.filterKey || "assigned_to_email";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "match";
  const emailKey: string = `${filterKey}__${filterOperation}`;
</script>

<!--
  Remount the inner filter whenever the APPLIED email filter changes (Enter, member-pick, X, or the
  column menu's "Clear filter"). That re-seeds the inner component's `draft` from `filters` — so an
  external clear empties the input box too. Plain typing doesn't change `filters[emailKey]`, so it
  doesn't remount and the in-progress text is preserved. A template `{#key}` only remounts child
  components, not script state, which is why the stateful logic lives in the inner component.
-->
{#key filters[emailKey] ?? ""}
  <AssignedToEmailFilter {columnSetting} {contexts} {filters} {onFilter} />
{/key}
