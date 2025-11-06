<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { setContext, type Snippet } from "svelte";

  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";

  import { datasetTabs, type DatasetTab } from "@/components/app/datasets/tabs/dataset.tabs";

  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;
  let activeTab: DatasetTab = $derived(page.url.pathname.split("/").pop() as DatasetTab);

  // Records
  let dataset: DatasetRecord = $state(new DatasetRecord());

  $effect(() => {
    setContext("dataset", dataset);
  });

  // Functions
  async function fetchData() {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        "dataset:datasets": ["name"],
      },
    });
    dataset = datasetRes.data;
    return dataset;
  }

  function handleTabChange(value: DatasetTab): void {
    goto(resolve(`/projects/${projectId}/datasets/${datasetId}/${value}`));
  }
</script>

{#await fetchData()}
  <PageLoading></PageLoading>
{:then datasetRecord}
  <div class="space-y-6">
    <PageHeader title={datasetRecord.name}></PageHeader>
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
