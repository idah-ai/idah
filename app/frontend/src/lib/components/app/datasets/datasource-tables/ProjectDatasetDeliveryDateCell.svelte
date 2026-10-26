<script lang="ts">
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
  let { delivery_date } = $derived(dataset);
</script>

<span>{delivery_date}</span>
