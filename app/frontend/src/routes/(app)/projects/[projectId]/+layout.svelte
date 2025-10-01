<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import PageProvider from "@/components/app/page/page-provider.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { humanize } from "@/utils/string";
  import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { projectTabs, type ProjectTab } from "@/components/app/projects/tabs/project.tabs";
  import { refetches } from "@/utils/refetch";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

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

  // Reactive variables
  let isDatasetPage = $derived(page.url.pathname.split("/").length > 4);

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());
  let { name, description } = $derived(project);

  // Lifecycle
  // onMount(() => {
  //   const currentTab = projectTabs.find((tab) => tab.value === activeTab);
  //   const defaultProjectTab: ProjectTab = "datasets";

  //   if (!currentTab) {
  //     goto(`/projects/${projectId}/${defaultProjectTab}`, { replaceState: true });
  //   } else {
  //     goto(`/projects/${projectId}/${currentTab.value}`, { replaceState: true });
  //   }
  // });

  $effect(() => {
    updateBreadcrumbs(page.url.pathname);
  });

  // Functions
  async function fetchProject(): Promise<void> {
    const projectRes = await projectsBackendDataSource.get(projectId, {
      fields: {
        "datasets/projects": ["name"],
      },
    });
    project = projectRes.data;
    updateBreadcrumbs(page.url.pathname);
  }

  async function updateBreadcrumbs(pathname: string): Promise<void> {
    const pathSegments = pathname.split("/");
    const projectSegment = pathSegments[3] as ProjectTab;
    const projectSegmentId = pathSegments[4] as string;
    const currentProjectTab = projectTabs.find((tab) => tab.value === projectSegment);

    const projectDetailFallbackBreadcrumbs = [
      projectBreadcrumb,
      { label: project.name, href: `/projects/${projectId}/${projectSegment}` },
      { label: currentProjectTab?.label || humanize(projectSegment), href: `/projects/${projectId}/${projectSegment}` },
    ];

    if (projectSegmentId) {
      switch (projectSegment) {
        case "datasets": {
          /** Get dataset name to show in breadcrumb */
          const datasetRes = await datasetsBackendDataSource.get(projectSegmentId, {
            fields: {
              [DatasetRecord.type]: ["name"],
            },
          });
          breadcrumbs = [
            ...projectDetailFallbackBreadcrumbs,
            { label: datasetRes.data.name, href: `/projects/${projectId}/datasets/${projectSegmentId}` },
          ];
          break;
        }

        case "members": {
          break;
        }
      }
    } else {
      breadcrumbs = projectDetailFallbackBreadcrumbs;
    }
  }

  function handleTabChange(value: ProjectTab): void {
    goto(`/projects/${projectId}/${value}`);
  }
</script>

{#key $refetches.projects.get}
  {#await fetchProject()}
    <PageLoading />
  {:then _}
    <PageProvider name="project-detail" {breadcrumbs}>
      {#if !isDatasetPage}
        <PageHeader title={name} {description}>
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
{/key}
