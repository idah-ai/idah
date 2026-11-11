<script lang="ts">
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    ProjectDashboardController,
    setProjectDashboardController,
  } from "$lib/components/app/projects/dashboard/project-dashboard-controller.svelte";

  import ProjectDatasetSelection from "./sections/_ProjectDatasetSelection.svelte";
  import DatasetMetricsCard from "./sections/_DatasetMetricsCard.svelte";
  import EntriesByStatusCard from "./sections/_EntriesByStatusCard.svelte";
  import CompletedEntriesPerPeriodCard from "./sections/_CompletedEntriesPerPeriodCard.svelte";
  import ProgressByDatasetCard from "./sections/_ProgressByDatasetCard.svelte";
  import OpenEntriesCard from "./sections/_OpenEntriesCard.svelte";
  import AnnotationsByCategoryCard from "./sections/_AnnotationsByCategoryCard.svelte";

  interface Props {
    projectId: string;
  }
  let { projectId }: Props = $props();

  // Initialized Controller here.
  // Passing the controller or set controller as context
  // So that child components can access it.
  const controller = new ProjectDashboardController(projectId);
  setProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY, controller);
</script>

<div class="grid gap-4">
  <ProjectDatasetSelection />

  <DatasetMetricsCard />

  <EntriesByStatusCard />

  <CompletedEntriesPerPeriodCard />

  <ProgressByDatasetCard />

  <OpenEntriesCard />

  <AnnotationsByCategoryCard />
</div>
