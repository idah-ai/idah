<script lang="ts">
  import { page } from "$app/state";
  import { SaveIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";

  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { humanize, slugify } from "@/utils/string";

  import {
    labelColors,
    type LabelConfigurationProperty,
    type LabelConfigurations,
    type LabelConfigurationValue,
    type LabelingConfiguration,
  } from "@/data/model/dataset/labels";

  // Variables
  let datasetId: string = page.params.datasetId as string;

  let saving: boolean = $state(false);
  let _modality: string = $state("video");
  let labelConfig: LabelConfigurations = $state({});
  let initialLabelConfig: LabelingConfiguration | undefined = $state(undefined);
  let isLabelConfigChanged: boolean = $derived.by(() => {
    return JSON.stringify(labelConfig) !== JSON.stringify(initialLabelConfig);
  });

  // Functions
  async function fetchData(): Promise<void> {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["modality", "labeling_configuration"],
      },
    });
    _modality = datasetRes.data.modality;
    labelConfig = datasetRes.data.labeling_configuration;
    initialLabelConfig = JSON.parse(JSON.stringify(labelConfig));
  }

  async function saveLabelConfigChanges(): Promise<void> {
    saving = true;
    try {
      const updatedDatasetRes = await datasetsBackendDataSource.update(datasetId, {
        attributes: {
          labeling_configuration: labelConfig,
        },
      });
      initialLabelConfig = JSON.parse(JSON.stringify(updatedDatasetRes.data.labeling_configuration));
      toast.success("Labeling configuration changes saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save labeling configuration changes.");
    } finally {
      saving = false;
    }
  }

  function addCategory(labelConfigKey: string, nodeId?: string) {
    if (!labelConfig) return;

    const currentTime = new Date().getTime().toString();
    const newLabel = "New Category";
    const newId = slugify(currentTime);
    const selectedLabelConfig: LabelingConfiguration = labelConfig[labelConfigKey];
    const usedColors = selectedLabelConfig.values.map((cat) => cat.color);
    const availableColors = labelColors.filter((color) => !usedColors.includes(color.color));
    const firstAvailableColor = availableColors[0];

    /** Add a new root category, if nodeId is not provided */
    if (!nodeId) {
      selectedLabelConfig.values.push({
        id: newId,
        label: newLabel,
        color: firstAvailableColor.color,
        text_color: firstAvailableColor.text_color,
        selectable: false,
      });
      return;
    }

    const parentCategories = selectedLabelConfig.values.filter((cat) => cat.id.startsWith(nodeId));
    /** Add a new sub-category, if parent category not exists */
    if (!parentCategories.length) {
      selectedLabelConfig.values.push({
        id: `${nodeId}/${currentTime}`,
        label: newLabel,
        color: firstAvailableColor.color,
        text_color: firstAvailableColor.text_color,
        selectable: true,
      });
      return;
    }

    /** Add a new sub-category, if parent category exists */
    if (parentCategories.length === 1) {
      const parentCategoryIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === nodeId);
      if (parentCategoryIndex !== -1) {
        /** Update the existing one with currentTime */
        selectedLabelConfig.values[parentCategoryIndex] = {
          ...selectedLabelConfig.values[parentCategoryIndex],
          id: `${selectedLabelConfig.values[parentCategoryIndex].id}/${currentTime}`,
          label: newLabel,
          selectable: true,
        };
      } else {
        /** Just in case, if not found, add a new one */
        selectedLabelConfig.values.push({
          id: `${nodeId}/${currentTime}`,
          label: newLabel,
          color: firstAvailableColor.color,
          text_color: firstAvailableColor.text_color,
          selectable: true,
        });
      }

      return;
    }

    /** Add a new sub-category, if multiple parent categories exist */
    selectedLabelConfig.values.push({
      id: `${nodeId}/${currentTime}`,
      label: newLabel,
      color: firstAvailableColor.color,
      text_color: firstAvailableColor.text_color,
      selectable: true,
    });
  }

  function editCategory(labelConfigKey: string, category: LabelConfigurationValue) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === category.id);

    if (categoryToUpdateIndex >= 0) {
      const existingCategory = selectedLabelConfig.values[categoryToUpdateIndex];
      const slugifiedLabel: string = slugify(category.label);
      const newId = existingCategory.id.split("/").slice(0, -1).concat(slugifiedLabel).join("/");

      selectedLabelConfig.values[categoryToUpdateIndex] = {
        ...existingCategory,
        ...category,
        label: category.label,
        id: newId,
      };
    } else {
      selectedLabelConfig.values.push(category);
    }
  }

  function editCategoryId(labelConfigKey: string, oldId: string, newId: string) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === oldId);
    if (categoryToUpdateIndex >= 0) {
      selectedLabelConfig.values[categoryToUpdateIndex].id = newId;
    }
  }

  function removeCategory(labelConfigKey: string, categoryId: string) {
    console.log(categoryId);

    if (!labelConfig) return;
    // Filter out the exact category with the given ID
    // This will only remove the exact match, keeping any parent categories
    const selectedLabelConfig: LabelingConfiguration = labelConfig[labelConfigKey];
    const usedColors = selectedLabelConfig.values.map((cat) => cat.color);
    const availableColors = labelColors.filter((color) => !usedColors.includes(color.color));
    const firstAvailableColor = availableColors[0];

    selectedLabelConfig.values = selectedLabelConfig.values.filter((cat) => !cat.id.includes(categoryId));

    // Check if we need to create a parent category
    const categoryPaths = categoryId.split("/");
    if (categoryPaths.length > 1) {
      // Create the parent path by removing the last segment
      const parentPath = categoryPaths.slice(0, -1).join("/");
      // Check if the parent category already exists
      const parentExists = selectedLabelConfig.values.some((cat) => cat.id === parentPath);

      // If parent doesn't exist, create it
      if (!parentExists) {
        selectedLabelConfig.values.push({
          id: parentPath,
          label: humanize(parentPath),
          color: firstAvailableColor.color,
          text_color: firstAvailableColor.text_color,
          selectable: false,
        });
      }
    }
  }

  function setProperty(labelConfigKey: string, property: LabelConfigurationProperty) {
    if (!labelConfig) return;
    const selectedLabelConfig = labelConfig[labelConfigKey];
    const propertyToUpdateIndex = selectedLabelConfig.properties.findIndex((p) => p.id === property.id);
    if (propertyToUpdateIndex >= 0) {
      selectedLabelConfig.properties[propertyToUpdateIndex] = {
        ...property,
        id: slugify(property.label),
      };
    } else {
      selectedLabelConfig.properties.push(property);
    }
  }

  function removeProperty(labelConfigKey: string, propertyId: string) {
    if (!labelConfig) return;
    const selectedLabelConfig = labelConfig[labelConfigKey];
    selectedLabelConfig.properties = selectedLabelConfig.properties.filter((p) => p.id !== propertyId);
  }
</script>

{#await fetchData()}
  <PageLoading></PageLoading>
{:then _}
  <PageHeader title="Label">
    {#snippet slotTitle()}
      <Button
        loading={saving}
        loadingLabel="Saving"
        disabled={!isLabelConfigChanged}
        class="ml-auto"
        onclick={saveLabelConfigChanges}
      >
        <SaveIcon class="size-4"></SaveIcon>
        {isLabelConfigChanged ? "Save Changes" : "Saved"}
      </Button>
    {/snippet}
  </PageHeader>

  <LabelConfigEditor
    {labelConfig}
    onAddCategory={addCategory}
    onEditCategoryId={editCategoryId}
    onEditCategory={editCategory}
    onRemoveCategory={removeCategory}
    onSetProperty={setProperty}
    onRemoveProperty={removeProperty}
  />
{/await}
