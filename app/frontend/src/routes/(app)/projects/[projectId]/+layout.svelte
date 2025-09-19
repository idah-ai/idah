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

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());

  // Lifecycle
  onMount(() => {
    const currentTab = projectTabs.find((tab) => tab.value === activeTab);
    const defaultProjectTab: ProjectTab = "members";

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
    breadcrumbs = [projectBreadcrumb, { label: project.name }];
  }

  function handleTabChange(value: ProjectTab): void {
    goto(`/projects/${projectId}/${value}`);
  }
</script>

{#await fetchProject()}
  <PageLoading />
{:then _}
  <PageProvider name="project-detail" {breadcrumbs}>
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

    {@render children()}
  </PageProvider>
{/await}
