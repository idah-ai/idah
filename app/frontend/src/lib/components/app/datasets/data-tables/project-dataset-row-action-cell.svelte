<script lang="ts">
  import ProjectDatasetDropdownMenu from "@/components/app/datasets/dropdowns/project-dataset-dropdown-menu.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    record: DatasetRecord;
  }
  let { record: dataset }: Props = $props();
  console.log(dataset);
</script>

<ProjectDatasetDropdownMenu datasetId={dataset.id} projectId={dataset._jsonapiData?.relationships?.project.data.id} />
