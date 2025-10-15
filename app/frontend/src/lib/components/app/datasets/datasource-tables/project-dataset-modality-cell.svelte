<script lang="ts">
  import DatasetModality from "@/components/app/datasets/badges/dataset-modality.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();

  // Variables
</script>

<DatasetModality {dataset}></DatasetModality>
