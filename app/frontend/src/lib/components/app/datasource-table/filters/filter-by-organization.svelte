<script lang="ts">
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { LabelValue } from "@/utils/types";

  // Props
  let { columnSetting, filters, onFilter }: DataTableFilterBaseProps<ProjectRecord> = $props();

  // Variables
  const resource: string = OrganizationRecord.type;
  const filterKey: string = columnSetting.filterOptions?.filterKey || "organization_id";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "in";
  const filterKeyWithOperation: string = `${filterKey}__${filterOperation}`;

  // Functions
  function handleFilter(selectedChoices: LabelValue<string | number>[]): void {
    onFilter({
      filters: {
        [filterKeyWithOperation]: selectedChoices.map((choice) => choice.value),
      },
    });
  }
</script>

<MultipleSelectDatasourceField
  name="{resource}/organization_id"
  dataSource={organizationsBackendDataSource}
  displayKey="name"
  values={filters[filterKeyWithOperation]}
  placeholder="Select an organization"
  searchKeyWithOperation="name__match"
  onSelected={handleFilter}
></MultipleSelectDatasourceField>
