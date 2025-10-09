<script lang="ts">
  import DatasetStatus from "@/components/app/datasets/badges/dataset-status.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
</script>

<DatasetStatus {dataset}></DatasetStatus>
