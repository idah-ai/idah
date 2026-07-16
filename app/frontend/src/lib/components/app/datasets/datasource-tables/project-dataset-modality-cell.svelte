<script lang="ts">
  import DatasetModality from "@/components/app/datasets/badges/DatasetModalityBadge.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
</script>

<DatasetModality modality={dataset.modality} />
