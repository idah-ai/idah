<script lang="ts">
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/data-table/data-table.types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props extends DataTableFilterBaseProps<EntryRecord> {}
  let { columnSetting, onFilter }: Props = $props();

  // Varibles
  const resource: string = AccountRecord.type;
  const filterKey: string = columnSetting.filterOptions?.filterKey || "account_id";
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
  name="{resource}/account_id"
  dataSource={accountsBackendDataSource}
  displayKey="name"
  value={selectedValue}
  onValueChange={handleFilter}
></SingleSelectDatasourceField>
