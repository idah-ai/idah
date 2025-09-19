<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import PageProvider from "@/components/app/page/page-provider.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { projectTabs, type ProjectTab } from "@/components/app/projects/tabs/project.tabs";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = page.params.projectId as string;
  let activeTab: ProjectTab = $derived(page.url.pathname.split("/").pop() as ProjectTab);
  let breadcrumbs: PageBreadcrumbItem[] = $state([projectBreadcrumb]);
  let openNewProjectModal: boolean = $state(false);

  // Reactive variables
  let isDatasetPage = $derived(page.url.pathname.split("/").length > 4);

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());

  // Lifecycle
  onMount(() => {
    const currentTab = projectTabs.find((tab) => tab.value === activeTab);
    const defaultProjectTab: ProjectTab = "datasets";

    if (!currentTab) {
      goto(`/projects/${projectId}/${defaultProjectTab}`, { replaceState: true });
    } else {
      goto(`/projects/${projectId}/${currentTab.value}`, { replaceState: true });
    }
  });

  // Functions
  async function fetchProject(): Promise<void> {
    const projectRes = await projectsBackendDataSource.get(projectId, {
      fields: {
        "datasets/projects": ["name"],
      },
    });
    project = projectRes.data;
    updateBreadcrumbs();
  }

  async function updateBreadcrumbs(): Promise<void> {
    if (isDatasetPage) {
      const pathSegments = page.url.pathname.split("/");
      const datasetId = pathSegments[4];
      // Fetch dataset name for breadcrumb
      try {
        const datasetRes = await datasetsBackendDataSource.get(datasetId, {
          fields: {
            "dataset:datasets": ["name"],
          },
        });
        breadcrumbs = [
          projectBreadcrumb,
          { label: project.name },
          { label: "Datasets", href: `/projects/${projectId}/datasets` },
          { label: datasetRes.data.name },
        ];
      } catch {
        breadcrumbs = [projectBreadcrumb, { label: project.name }];
      }
    } else {
      breadcrumbs = [projectBreadcrumb, { label: project.name }];
    }
  }

  // Reactive effect to update breadcrumbs when route changes
  $effect(() => {
    if (project.name) {
      updateBreadcrumbs();
    }
  });

  function handleTabChange(value: ProjectTab): void {
    goto(`/projects/${projectId}/${value}`);
  }
</script>

{#await fetchProject()}
  <PageLoading />
{:then _}
  <PageProvider name="project-detail" {breadcrumbs}>
    {#if !isDatasetPage}
      <PageHeader title={project.name}>
        {#snippet actions()}
          <ProjectDropdownMenu {projectId} />
        {/snippet}
      </PageHeader>

      <Tabs bind:value={activeTab}>
        <TabsList>
          {#each projectTabs as { label, value } (value)}
            <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
          {/each}
        </TabsList>
      </Tabs>
    {/if}

    {@render children()}
  </PageProvider>
{/await}
