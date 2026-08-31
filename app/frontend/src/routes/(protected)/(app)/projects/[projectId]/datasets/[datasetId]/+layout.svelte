<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount, setContext, type Snippet } from "svelte";

  import DatasetModalityBadge from "@/components/app/datasets/badges/DatasetModalityBadge.svelte";
  import ProjectDatasetDropdownMenu from "@/components/app/datasets/dropdowns/project-dataset-dropdown-menu.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Text from "@/components/ui/text/Text.svelte";

  import { datasetTabs, type DatasetTab } from "@/components/app/datasets/tabs/dataset.tabs";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { authStatus } from "@/security/AuthContext";

  import { refetches } from "@/utils/refetch";

  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = $derived(page.params.projectId as string);
  let datasetId: string = $derived(page.params.datasetId as string);
  let tabs = $state(datasetTabs);
  let activeTab: DatasetTab = $derived(page.url.pathname.split("/").pop() as DatasetTab);

  // Records
  let dataset: DatasetRecord = $state(new DatasetRecord());

  $effect(() => {
    setContext("dataset", dataset);
  });

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };
    const canUpdateDataset = await currentAccount?.can("update", "dataset:datasets", [
      "as_org_owner",
      as_project_owner,
    ]);

    if (!canUpdateDataset) {
      tabs = datasetTabs.filter((tab) => tab.value !== "labels");
    }
  });

  // Functions
  async function fetchData() {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["name", "modality"],
      },
    });
    dataset = datasetRes.data;
    return dataset;
  }

  /**
   * Tabs are a view of the URL, never their own state.
   *
   * bits-ui activates a trigger optimistically, before any navigation resolves. That would
   * strand the tab on a destination the router never reached — the labels page cancels
   * navigation when there are unsaved changes, so cancelling the prompt used to leave the
   * tab on the page the user never went to.
   *
   * Preventing the event stops that activation: svelte-toolbelt's `composeHandlers` runs our
   * handler before the primitive's and skips the rest once `defaultPrevented` is set. The
   * tab therefore only moves when `activeTab` recomputes from a URL that actually changed.
   */
  function selectTab(event: Event, value: DatasetTab): void {
    event.preventDefault();
    if (value === activeTab) return;

    goto(resolve(`/projects/${projectId}/datasets/${datasetId}/${value}`));
  }
</script>

{#key $refetches.datasets.get}
  {#await fetchData()}
    <PageLoading />
  {:then datasetRecord}
    <div class="space-y-6">
      <PageHeader>
        {#snippet slotTitle()}
          <div class="flex items-center gap-2">
            <Text size="h2" weight="semibold">{datasetRecord.name}</Text>
            <DatasetModalityBadge modality={datasetRecord.modality} />
            <ProjectDatasetDropdownMenu {datasetId} datasetName={datasetRecord.name} {projectId} align="center" />
          </div>
        {/snippet}
      </PageHeader>

      <!-- One-way: the URL owns the selection, so a cancelled navigation leaves it untouched. -->
      <Tabs value={activeTab} activationMode="manual">
        <TabsList>
          {#each tabs as { label, value } (value)}
            <TabsTrigger
              {value}
              onclick={(event) => selectTab(event, value)}
              onkeydown={(event) => {
                /* Enter/Space would otherwise activate optimistically and swallow the click. */
                if (event.key !== "Enter" && event.key !== " ") return;
                selectTab(event, value);
              }}
            >
              {label}
            </TabsTrigger>
          {/each}
        </TabsList>
      </Tabs>

      {@render children()}
    </div>
  {/await}
{/key}
