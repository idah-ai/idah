<script lang="ts">
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: project, contexts }: DataTableCellBaseProps<ProjectRecord> = $props();

  // Variables
  const datasets: DatasetRecord[] = $derived(contexts?.datasets ?? []);
  const projectDatasets = $derived(
    datasets.filter((dataset) => dataset._jsonapiData.relationships?.project.data.id === project.id),
  );
</script>

{projectDatasets.length}
