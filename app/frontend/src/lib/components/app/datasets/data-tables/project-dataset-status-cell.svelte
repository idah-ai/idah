<script lang="ts">
  import DatasetStatus from "@/components/app/datasets/badges/dataset-status.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<DatasetRecord> {}
  let { record: dataset }: Props = $props();

  // Variables
</script>

<DatasetStatus {dataset}></DatasetStatus>
