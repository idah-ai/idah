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

  import { labelColors, type LabelConfigurations, type LabelingConfiguration } from "@/data/model/dataset/labels";

  // Variables
  let datasetId: string = page.params.datasetId as string;

  let saving: boolean = $state(false);
  let modality: string = $state("video");
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
    modality = datasetRes.data.modality;
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
    const newId = slugify(`${newLabel} ${currentTime}`);
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
        };
      } else {
        /** Just in case, if not found, add a new one */
        selectedLabelConfig.values.push({
          id: `${nodeId}/${currentTime}`,
          label: newLabel,
          color: firstAvailableColor.color,
          text_color: firstAvailableColor.text_color,
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
    });
  }

  function editCategory(category: CategoryField) {
    if (!labelConfig) return;

    // const categoryToUpdateIndex = labelConfig.categories.findIndex((cat) => cat.id === category.id);

    // if (categoryToUpdateIndex >= 0) {
    //   const existingCategory = labelConfig.categories[categoryToUpdateIndex];
    //   const slugifiedLabel: string = slugify(category.label);
    //   const newId = existingCategory.id.split("/").slice(0, -1).concat(slugifiedLabel).join("/");

    //   labelConfig.categories[categoryToUpdateIndex] = {
    //     ...existingCategory,
    //     ...category,
    //     label: category.label,
    //     id: newId,
    //   };
    // } else {
    //   labelConfig.categories.push(category);
    // }
  }

  function editCategoryId(oldId: string, newId: string) {
    // if (!labelConfig) return;
    // const categoryToUpdateIndex = labelConfig.categories.findIndex((cat) => cat.id === oldId);
    // if (categoryToUpdateIndex >= 0) {
    //   labelConfig.categories[categoryToUpdateIndex].id = newId;
    //   // labelConfig.categories[categoryToUpdateIndex].label = newId;
    // }
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
        });
      }
    }

    // Remove the category from property selectors
    // if (labelConfig.properties && labelConfig.properties.length > 0) {
    //   labelConfig.properties = labelConfig.properties.map((property) => {
    //     // Filter out selectors that match the removed category
    //     // This handles both exact matches and wildcard patterns
    //     const updatedSelector = property.selector.filter((selector) => {
    //       // Remove exact matches
    //       if (selector === categoryId) {
    //         return false;
    //       }
    //       // Remove wildcard patterns that include the category
    //       if (selector === `${categoryId}/*`) {
    //         return false;
    //       }
    //       // Remove if the selector is a child of the removed category
    //       if (selector.startsWith(`${categoryId}/`)) {
    //         return false;
    //       }
    //       return true;
    //     });
    //     return {
    //       ...property,
    //       selector: updatedSelector,
    //     };
    //   });
    // }
  }

  function setProperty(property: PropertyField) {
    // if (!labelConfig) return;
    // const propertyToUpdateIndex = labelConfig.properties.findIndex((p) => p.id === property.id);
    // if (propertyToUpdateIndex >= 0) {
    //   labelConfig.properties[propertyToUpdateIndex] = {
    //     ...property,
    //     id: slugify(property.label),
    //   };
    // } else {
    //   labelConfig.properties.push(property);
    // }
  }

  function removeProperty(propertyId: string) {
    // if (!labelConfig) return;
    // labelConfig.properties = labelConfig.properties.filter((p) => p.id !== propertyId);
  }

  function setTag(tag: TagField) {
    // if (!labelConfig) return;
    // if (!labelConfig.taggings) {
    //   labelConfig.taggings = [];
    // }
    // const tagToUpdateIndex = labelConfig.taggings.findIndex((t) => t.id === tag.id);
    // if (tagToUpdateIndex >= 0) {
    //   labelConfig.taggings[tagToUpdateIndex] = {
    //     ...tag,
    //     id: slugify(tag.label),
    //   };
    // } else {
    //   labelConfig.taggings.push(tag);
    // }
  }

  function removeTag(tagId: string) {
    // if (!labelConfig || !labelConfig.taggings) return;
    // labelConfig.taggings = labelConfig.taggings.filter((t) => t.id !== tagId);
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

  <LabelConfigEditor {labelConfig} onAddCategory={addCategory} onRemoveCategory={removeCategory} />

  <!-- <LabelEditor
    {labelConfig}
    onAddCategory={addCategory}
    onEditCategory={editCategory}
    onEditCategoryId={editCategoryId}
    onRemoveCategory={removeCategory}
    onSetProperty={setProperty}
    onRemoveProperty={removeProperty}
    onSetTag={setTag}
    onRemoveTag={removeTag}
  ></LabelEditor> -->
{/await}
