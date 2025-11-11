<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext } from "svelte";

  import ProjectAnalyticOverview from "@/components/app/projects/analytics/project-analytic-overview.svelte";
  import ProjectAnalyticPerformance from "@/components/app/projects/analytics/project-analytic-performance.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import {
    projectAnalyticTabs,
    type ProjectAnalyticTab,
  } from "@/components/app/projects/analytics/tabs/project-analytic.tabs";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  let projectId: string = page.params.projectId as string;
  let activeTab: ProjectAnalyticTab = $state("overview");

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name },
    { label: "Datasets" },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/`) },
    { label: "Analytics" },
  ]);
</script>

<Tabs bind:value={activeTab}>
  <TabsList>
    {#each projectAnalyticTabs as { label, value } (value)}
      <TabsTrigger {value}>{label}</TabsTrigger>
    {/each}
  </TabsList>

  <TabsContent value="overview" class="pt-4">
    <ProjectAnalyticOverview />
  </TabsContent>

  <TabsContent value="performance" class="pt-4">
    <ProjectAnalyticPerformance />
  </TabsContent>
</Tabs>
