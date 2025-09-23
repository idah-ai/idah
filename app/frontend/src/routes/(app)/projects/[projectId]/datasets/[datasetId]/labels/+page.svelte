<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import EmptyLabelResponseBlock from "@/components/app/datasets/labels/blocks/empty-label-response-block.svelte";
  import LabelEditor from "@/components/app/datasets/labels/label-editor.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";

  import Spinner from "@/components/app/loading/spinner.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { toast } from "svelte-sonner";
  import { labelTabs, type LabelTab } from "@/components/app/datasets/labels/tabs/label.tabs";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import type {
    LabelCategoryConfiguration,
    LabelingConfiguration,
    LabelPropertyConfiguration,
  } from "@/data/model/dataset/types";
  import { labelColors } from "@/components/app/datasets/labels/label-color";

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;

  let saving: boolean = $state(false);
  let currentTab: LabelTab = $state("manual");
  let modality: string = $state("video");
  let defaultCategoryType: string = $derived(`${modality}:bounding_box`);
  let labelConfig: LabelingConfiguration | undefined = $state(undefined);
  let isAlreadyDefineLabelConfig: boolean = $derived.by(() => {
    if (!labelConfig) return false;

    if (!Object.values(labelConfig.categories).length) return false;

    return true;
  });
  let usedColors = $derived.by(() => {
    return labelConfig ? labelConfig.categories.map((cat) => cat.color) : [];
  });
  const availableColors = $derived(labelColors.filter((color) => !usedColors.includes(color.color)));
  const firstAvailableColor = $derived.by(() => {
    return availableColors.length
      ? availableColors[0].color
      : labelColors[Math.floor(Math.random() * labelColors.length)].color;
  });

  // Functions
  async function fetchData(): Promise<void> {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["modality", "labeling_configuration"],
      },
    });
    modality = datasetRes.data.modality;
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

  function addNewCategory(nodeId?: string) {
    if (!labelConfig) return;

    const newId = new Date().getTime().toString();

    /** Add a new root category, if nodeId is not provided */
    if (!nodeId) {
      labelConfig.categories.push({
        id: `${newId}`,
        type: defaultCategoryType,
        label: "New Category",
        color: firstAvailableColor,
      });
      return;
    }

    const parentCategories = labelConfig.categories.filter((cat) => cat.id.startsWith(nodeId));
    /** Add a new sub-category, if parent category not exists */
    if (!parentCategories.length) {
      labelConfig.categories.push({
        id: `${nodeId}/${newId}`,
        label: `${nodeId}/${newId}`,
        type: defaultCategoryType,
        color: firstAvailableColor,
      });
      return;
    }

    /** Add a new sub-category, if parent category exists */
    if (parentCategories.length === 1) {
      const parentCategoryIndex = labelConfig.categories.findIndex((cat) => cat.id === nodeId);
      if (parentCategoryIndex !== -1) {
        /** Update the existing one with newId */
        labelConfig.categories[parentCategoryIndex] = {
          ...labelConfig.categories[parentCategoryIndex],
          id: `${labelConfig.categories[parentCategoryIndex].id}/${newId}`,
        };
      } else {
        /** Just in case, if not found, add a new one */
        labelConfig.categories.push({
          id: `${nodeId}/${newId}`,
          label: `${nodeId}/${newId}`,
          type: defaultCategoryType,
          color: firstAvailableColor,
        });
      }

      return;
    }

    /** Add a new sub-category, if multiple parent categories exist */
    labelConfig.categories.push({
      id: `${nodeId}/${newId}`,
      label: `${nodeId}/${newId}`,
      type: defaultCategoryType,
      color: firstAvailableColor,
    });
  }

  function editCategory(category: LabelCategoryConfiguration) {
    if (!labelConfig) return;

    const categoryToUpdateIndex = labelConfig.categories.findIndex((cat) => cat.id === category.id);

    if (categoryToUpdateIndex >= 0) {
      labelConfig.categories[categoryToUpdateIndex] = category;
    } else {
      labelConfig.categories.push(category);
    }
  }

  function editCategoryId(oldId: string, newId: string) {
    if (!labelConfig) return;

    const categoryToUpdateIndex = labelConfig.categories.findIndex((cat) => cat.id === oldId);

    if (categoryToUpdateIndex >= 0) {
      labelConfig.categories[categoryToUpdateIndex].id = newId;
      labelConfig.categories[categoryToUpdateIndex].label = newId;
    }
  }

  function removeCategory(categoryId: string) {
    if (!labelConfig) return;

    // Filter out the exact category with the given ID
    // This will only remove the exact match, keeping any parent categories
    labelConfig.categories = labelConfig.categories.filter((cat) => !cat.id.includes(categoryId));

    // Check if we need to create a parent category
    const categoryPaths = categoryId.split("/");
    if (categoryPaths.length > 1) {
      // Create the parent path by removing the last segment
      const parentPath = categoryPaths.slice(0, -1).join("/");

      // Check if the parent category already exists
      const parentExists = labelConfig.categories.some((cat) => cat.id === parentPath);

      // If parent doesn't exist, create it
      if (!parentExists) {
        labelConfig.categories.push({
          id: parentPath,
          label: parentPath,
          type: defaultCategoryType,
          color: firstAvailableColor,
        });
      }
    }
  }

  function setProperty(property: LabelPropertyConfiguration) {
    if (!labelConfig) return;

    const propertyToUpdateIndex = labelConfig.properties.findIndex((p) => p.id === property.id);

    if (propertyToUpdateIndex >= 0) {
      labelConfig.properties[propertyToUpdateIndex] = property;
    } else {
      labelConfig.properties.push(property);
    }
  }

  function removeProperty(propertyId: string) {
    if (!labelConfig) return;

    labelConfig.properties = labelConfig.properties.filter((p) => p.id !== propertyId);
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
        <LabelEditor
          {labelConfig}
          onAddCategory={addNewCategory}
          onEditCategory={editCategory}
          onEditCategoryId={editCategoryId}
          onRemoveCategory={removeCategory}
          onSetProperty={setProperty}
          onRemoveProperty={removeProperty}
        ></LabelEditor>
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
