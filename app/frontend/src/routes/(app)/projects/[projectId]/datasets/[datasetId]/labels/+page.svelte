<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import EmptyLabelResponseBlock from "@/components/app/datasets/labels/blocks/empty-label-response-block.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";

  import Spinner from "@/components/app/loading/spinner.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { toast } from "svelte-sonner";
  import { labelTabs, type LabelTab } from "@/components/app/datasets/labels/tabs/label.tabs";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import type { LabelingConfiguration } from "@/data/model/dataset/types";
  import LabelTree from "@/components/app/datasets/labels/trees/label-tree.svelte";

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;

  let saving: boolean = $state(false);
  let currentTab: LabelTab = $state("manual");
  let labelConfig: LabelingConfiguration | undefined = $state(undefined);
  let isAlreadyDefineLabelConfig: boolean = $derived.by(() => {
    if (!labelConfig) return false;

    if (!Object.values(labelConfig.categories).length) return false;

    return true;
  });

  // Functions
  async function fetchData(): Promise<void> {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["labeling_configuration"],
      },
    });
    labelConfig = datasetRes.data.labeling_configuration;
  }

  async function saveLabelConfigChanges(): Promise<void> {
    saving = true;
    try {
      await datasetsBackendDataSource.update(datasetId, {
        attributes: {
          labeling_configuration: labelConfig,
        },
      });
      toast.success("Labeling configuration changes saved successfully.");
    } catch (error) {
      toast.error("Failed to save labeling configuration changes.");
    } finally {
      saving = false;
    }
  }

  function addNewCategory(parentId?: string) {
    if (!labelConfig) return;

    labelConfig.categories.push({
      id: parentId
        ? `${parentId}/new_category_${labelConfig.categories.length + 1}`
        : `new_category_${labelConfig.categories.length + 1}`,
      type: "image",
      label: `New Category ${labelConfig.categories.length + 1}`,
      color: "#000000",
    });
  }

  function removeCategory(id: string) {
    if (!labelConfig) return;

    labelConfig.categories = labelConfig.categories.filter((cat) => !cat.id.includes(id));
  }
</script>

{#await fetchData()}
  <PageLoading></PageLoading>
{:then _}
  <Tabs bind:value={currentTab}>
    <PageHeader title="Label">
      {#snippet slotTitle()}
        <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
          <TabsList>
            {#each labelTabs as { label, value } (value)}
              <TabsTrigger {value}>{label}</TabsTrigger>
            {/each}
          </TabsList>
        </div>

        <Button disabled={saving} onclick={saveLabelConfigChanges}>
          {#if saving}
            <Spinner></Spinner>
            Saving
          {:else}
            Save
          {/if}
        </Button>
      {/snippet}
    </PageHeader>

    <TabsContent value="manual">
      {#if isAlreadyDefineLabelConfig && labelConfig}
        <LabelTree {labelConfig} onAddCategory={addNewCategory} onRemoveCategory={removeCategory}></LabelTree>
      {:else}
        <EmptyLabelResponseBlock onNewLabel={() => {}}></EmptyLabelResponseBlock>
      {/if}
    </TabsContent>

    <TabsContent value="json">
      {#if isAlreadyDefineLabelConfig}
        <pre>
          {JSON.stringify(labelConfig, null, 2)}
        </pre>
      {:else}
        <EmptyLabelResponseBlock onNewLabel={() => {}}></EmptyLabelResponseBlock>
      {/if}
    </TabsContent>
  </Tabs>
{/await}
