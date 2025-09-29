<script lang="ts">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/data-table/data-table.types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props extends DataTableFilterBaseProps<EntryRecord> {}
  let { columnSetting, onFilter }: Props = $props();

  // Varibles
  const resource: string = ProjectMemberRecord.type;
  const filterKey: string = columnSetting.filterOptions?.filterKey || "project_member_id";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "eq";
  const filterKeyWithOperation: string = `${filterKey}__${filterOperation}`;

  let selectedValue: number | null = $state(null);

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
  displayKey="email"
  value={selectedValue}
  onValueChange={handleFilter}
></SingleSelectDatasourceField>
