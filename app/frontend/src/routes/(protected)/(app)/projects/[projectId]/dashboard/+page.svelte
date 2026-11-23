<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext } from "svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import ProjectDashboard from "@/components/app/projects/dashboard/ProjectDashboard.svelte";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Variables
  const project = getContext<ProjectRecord>("project");
  const projectId = $derived(page.params.projectId as string);

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Dashboard" },
  ]);
</script>

<ProjectDashboard {projectId} />
