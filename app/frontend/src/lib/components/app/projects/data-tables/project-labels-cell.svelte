<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectRecord> {}
  let { record: project, contexts }: Props = $props();

  // Variables
  const { datasets } = contexts as { datasets: DatasetRecord[] };
  const dataset = $derived(
    datasets.find((dataset) => dataset._jsonapiData.relationships?.project.data.id == project.id),
  );
</script>

{dataset?.labels.length || 0}
