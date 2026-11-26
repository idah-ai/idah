<script lang="ts">
  import { onMount, untrack } from "svelte";

  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    ProjectDashboardController,
    setProjectDashboardController,
  } from "$lib/components/app/projects/dashboard/project-dashboard-controller.svelte";

  import ProjectDatasetSelection from "@/components/app/projects/dashboard/sections/_ProjectDatasetSelection.svelte";
  import DatasetMetricsCard from "@/components/app/projects/dashboard/sections/_DatasetMetricsCard.svelte";
  import EntriesByStatusCard from "@/components/app/projects/dashboard/sections/_EntriesByStatusCard.svelte";
  import CompletedEntriesPerPeriodCard from "@/components/app/projects/dashboard/sections/_CompletedEntriesPerPeriodCard.svelte";
  import ProgressByDatasetCard from "@/components/app/projects/dashboard/sections/_ProgressByDatasetCard.svelte";
  import OpenEntriesCard from "@/components/app/projects/dashboard/sections/_OpenEntriesCard.svelte";
  import AnnotationsByCategoryCard from "@/components/app/projects/dashboard/sections/_AnnotationsByCategoryCard.svelte";

  // Props
  interface Props {
    projectId: string;
  }
  let { projectId }: Props = $props();

  // Variables
  let entryCard: ReturnType<typeof OpenEntriesCard> | undefined;
  // One controller per instance; the page keys this component by project.
  const controller = new ProjectDashboardController(untrack(() => projectId));
  setProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY, controller);

  // LifeCycle
  onMount(() => {
    void controller.start();
    return () => controller.dispose();
  });
</script>

<div class="grid grid-cols-1 gap-4">
  <ProjectDatasetSelection />

  <DatasetMetricsCard onOpenEntries={() => void entryCard?.showOpenEntries()} />

  <EntriesByStatusCard />

  <CompletedEntriesPerPeriodCard />

  <ProgressByDatasetCard />

  <OpenEntriesCard bind:this={entryCard} />

  <AnnotationsByCategoryCard />
</div>
