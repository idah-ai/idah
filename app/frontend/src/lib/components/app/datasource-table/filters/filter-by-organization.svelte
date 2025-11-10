<script lang="ts">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";

  // Props
  let { columnSetting, filters, onFilter }: DataTableFilterBaseProps<ProjectRecord> = $props();

  // Variables
  const resource: string = OrganizationRecord.type;
  const filterKey: string = columnSetting.filterOptions?.filterKey || "organization_id";
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
  name="{resource}/organization_id"
  dataSource={organizationsBackendDataSource}
  displayKey="name"
  value={filters[filterKeyWithOperation]}
  placeholder="Select an organization"
  searchKeyWithOperation="name__match"
  onValueChange={handleFilter}
></SingleSelectDatasourceField>
