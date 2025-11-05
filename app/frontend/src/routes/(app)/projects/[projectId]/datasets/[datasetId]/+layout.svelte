<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, type Snippet } from "svelte";

  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { datasetTabs, type DatasetTab } from "@/components/app/datasets/tabs/dataset.tabs";
  // import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";

  import { resolve } from "$app/paths";
  // import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;
  let activeTab: DatasetTab = $derived(page.url.pathname.split("/").pop() as DatasetTab);
  // let breadcrumbs: PageBreadcrumbItem[] = $state([projectBreadcrumb]);

  // Records
  let _project: ProjectRecord = $state(new ProjectRecord());
  let dataset: DatasetRecord = $state(new DatasetRecord());

  // Lifecycle
  onMount(() => {
    const currentTab = datasetTabs.find((tab) => tab.value === activeTab);
    const defaultDatasetTab: DatasetTab = "entries";

    if (!currentTab) {
      goto(resolve(`/projects/${projectId}/datasets/${datasetId}/${defaultDatasetTab}`), { replaceState: true });
    } else {
      goto(resolve(`/projects/${projectId}/datasets/${datasetId}/${currentTab.value}`), { replaceState: true });
    }
  });

  // Functions
  async function fetchData(): Promise<void> {
    // Fetch project data
    const projectRes = await projectsBackendDataSource.get(projectId, {
      fields: {
        "datasets/projects": ["name"],
      },
    });
    _project = projectRes.data;

    // Fetch dataset data
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        "dataset:datasets": ["name"],
      },
    });
    dataset = datasetRes.data;

    // breadcrumbs = [
    //   projectBreadcrumb,
    //   { label: project.name, href: `/projects/${projectId}` },
    //   { label: "Datasets", href: `/projects/${projectId}/datasets` },
    //   { label: dataset.name },
    // ];
  }

  function handleTabChange(value: DatasetTab): void {
    goto(resolve(`/projects/${projectId}/datasets/${datasetId}/${value}`));
  }
</script>

{#await fetchData()}
  <PageLoading />
{:then _}
  <div class="space-y-6">
    <PageHeader title={dataset.name}></PageHeader>
    <Tabs bind:value={activeTab}>
      <TabsList>
        {#each datasetTabs as { label, value } (value)}
          <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
        {/each}
      </TabsList>
    </Tabs>

    {@render children()}
  </div>
{/await}
