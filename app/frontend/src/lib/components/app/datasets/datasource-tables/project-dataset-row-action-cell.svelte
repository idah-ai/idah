<script lang="ts">
  import ProjectDatasetDropdownMenu from "@/components/app/datasets/dropdowns/project-dataset-dropdown-menu.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { JsonApiReference } from "@/data/model/types";

  // Props

  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
  const data = dataset._jsonapiData?.relationships?.project.data as JsonApiReference;
</script>

<ProjectDatasetDropdownMenu datasetId={dataset.id} projectId={data.id!} />
