<script lang="ts" generics="T extends Record">
  import FilterSortDropdownMenu from "@/components/app/dropdown-menu/filter-sort-dropdown-menu.svelte";

  import type { Record } from "@/data/model/Record";
  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
    TablePreferences,
  } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props {
    columnKey: string;
    columnSetting: ColumnSettings<T>;
    tablePreferences: TablePreferences;
    // Props::Functions
    onFilter: (params: FilterDataSourceParams) => Promise<void>;
    onSort: (params: SortDataSourceParams) => Promise<void>;
    onHide: (columnKey: string) => void;
  }
  let {
    columnKey,
    columnSetting,
    tablePreferences,
    // Props::Functions
    onFilter,
    onSort,
    onHide,
  }: Props = $props();
</script>

<FilterSortDropdownMenu
  {columnKey}
  {columnSetting}
  filters={tablePreferences.filters}
  sort={tablePreferences.sort}
  {onFilter}
  {onSort}
  {onHide}
></FilterSortDropdownMenu>

