<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<Link href={`/projects/${controller.projectId}/datasets/${dataset.id}/entries`} target="_blank" showIcon>
  {dataset.name}
</Link>
