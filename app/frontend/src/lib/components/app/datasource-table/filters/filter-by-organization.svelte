<script lang="ts">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/dataset/organizations/record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<ProjectRecord> = $props();

  // Contexts
  if (!contexts || !("organizationId" in contexts)) {
    throw new Error("`organizationId` is required in contexts for FilterByOrganization");
  }

  let { organizationId } = contexts as { organizationId: string };

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
  listOptions={{
    filters: {
      id: organizationId,
    },
  }}
  displayKey="name"
  searchable
  searchKeyWithOperation="name__match"
  value={filters[filterKeyWithOperation]}
  onValueChange={handleFilter}
></SingleSelectDatasourceField>
