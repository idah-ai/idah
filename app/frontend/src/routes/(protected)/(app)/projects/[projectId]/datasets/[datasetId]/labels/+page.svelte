<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { SaveIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import LabelConfigTemplateDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/LabelConfigTemplateDropdownMenu.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { getTextColor, randomHex } from "@/components/app/color-picker/utils";
  import {
    categoryOrderMap,
    getCategoryOrder,
    getSiblingOrders,
  } from "@/components/app/datasets/labels/categories/utils";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { labelColors } from "@/data/model/dataset/labels";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { humanize, slugify } from "@/utils/string";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig, IConfigProperty, IConfigValue } from "@/plugin/v2/types";
  import type { ProjectMemberScope } from "@/security/types";

  /**
   * Sort values array by tree order so persisted order matches display order.
   * Uses categoryOrderMap from the tree component if available, otherwise
   * falls back to positional order.  On cold start (empty map), the existing
   * array order is used as-is.
   */
  function sortValuesByTreeOrder(values: IConfigValue[]): IConfigValue[] {
    return [...values].sort((a, b) => {
      const aOrder = getCategoryOrder(a.id) ?? Infinity;
      const bOrder = getCategoryOrder(b.id) ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });
  }

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;

  let saving = $state(false);
  let modality = $state("");
  let shapes = $state<ModalityShapes>({});
  let labelConfig: IConfig = $state({});

  /** Snapshot of the last saved / loaded state.  Compared against current
   *  config to detect whether there are unsaved changes. */
  let savedSnapshot = $state("");
  let hasUnsavedChanges = $derived(JSON.stringify(labelConfig) !== savedSnapshot);

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/labels`) },
    { label: "Label Editor" },
  ]);

  // Functions
  async function fetchData(): Promise<void> {
    // Clear stale order entries from any previously visited dataset
    for (const key of Object.keys(categoryOrderMap)) {
      delete categoryOrderMap[key];
    }

    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["modality", "labeling_configuration"],
      },
    });
    modality = datasetRes.data.modality;

    const showModalityRes = await pluginsBackendDataSource.showModality(modality);
    shapes = showModalityRes.shapes;

    labelConfig = datasetRes.data.labeling_configuration;
    savedSnapshot = JSON.stringify(labelConfig);
  }

  async function saveLabelConfigChanges(): Promise<void> {
    saving = true;
    /**
     * Remove unset config
     */
    const cleanedLabelConfig: IConfig = {};
    Object.entries(labelConfig).forEach(([key, config]) => {
      if (config.values.length > 0 || config.properties.length > 0) {
        cleanedLabelConfig[key] = {
          ...config,
          values: sortValuesByTreeOrder(config.values),
        };
      }
    });

    try {
      const updatedDatasetRes = await datasetsBackendDataSource.update(
        datasetId,
        {
          attributes: {
            labeling_configuration: cleanedLabelConfig,
          },
        },
        {
          showErrorToast: false,
        },
      );

      labelConfig = updatedDatasetRes.data.labeling_configuration;
      savedSnapshot = JSON.stringify(labelConfig);
      showToast.success({
        title: "Label configurations updated",
        description: "The changes has been saved.",
      });
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      saving = false;
    }
  }

  function addLabelConfig(labelConfigKey: string) {
    if (!labelConfig) return;

    if (!labelConfig[labelConfigKey]) {
      labelConfig[labelConfigKey] = {
        values: [],
        properties: [],
      };
    }
  }

  function duplicateConfig(sourceLabelConfigKey: string, targetLabelConfigKey: string) {
    if (!labelConfig) return;

    if (labelConfig[targetLabelConfigKey]) {
      showToast.error({
        title: "Configuration already exists",
        description: `A configuration named "${targetLabelConfigKey}" already exists.`,
      });
      return;
    }

    labelConfig[targetLabelConfigKey] = JSON.parse(JSON.stringify(labelConfig[sourceLabelConfigKey]));
  }

  function removeLabelConfig(key: string) {
    if (!labelConfig) return;
    labelConfig = Object.fromEntries(
      Object.entries(labelConfig).filter(([labelConfigKey, _]) => labelConfigKey !== key),
    );
  }

  function getColor(props: { labelConfigKey: string }) {
    const { labelConfigKey } = props;
    const selectedLabelConfig = labelConfig[labelConfigKey];
    const usedColors = selectedLabelConfig.values.map((cat) => cat.color);
    const remainingColors = labelColors.filter((color) => !usedColors.includes(color.color));
    const randomAvailableColor =
      remainingColors.length > 0 ? remainingColors[Math.floor(Math.random() * remainingColors.length)] : undefined;

    if (!randomAvailableColor) {
      let randomColor = randomHex();
      while (usedColors.includes(randomColor)) {
        randomColor = randomHex();
      }
      let textColor = getTextColor(randomColor);
      return { color: randomColor, text_color: textColor };
    } else {
      return { color: randomAvailableColor.color, text_color: randomAvailableColor.text_color };
    }
  }

  function addCategory(labelConfigKey: string, nodeId?: string) {
    if (!labelConfig) return;

    const currentTime = new Date().getTime().toString();
    const newLabel = "New Category";
    const newId = slugify(currentTime);
    const selectedLabelConfig = labelConfig[labelConfigKey];
    const { color, text_color } = getColor({ labelConfigKey });

    const categoryExists = (id: string) => selectedLabelConfig.values.some((cat) => cat.id === id);

    /** Add a new root category */
    if (!nodeId) {
      if (categoryExists(newId)) return;

      selectedLabelConfig.values.push({
        id: newId,
        label: newLabel,
        color,
        text_color,
      });
      return;
    }

    const childId = `${nodeId}/${currentTime}`;

    /** Prevent duplicate exact IDs */
    if (categoryExists(childId)) {
      return;
    }

    const parentCategories = selectedLabelConfig.values.filter(
      (cat) => cat.id === nodeId || cat.id.startsWith(`${nodeId}/`),
    );

    /** Add a new sub-category, if parent category not exists */
    if (!parentCategories.length) {
      selectedLabelConfig.values.push({
        id: childId,
        label: newLabel,
        color,
        text_color,
      });
      return;
    }

    /** Add a new sub-category, if parent category exists */
    if (parentCategories.length === 1) {
      const parentCategoryIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === nodeId);

      if (parentCategoryIndex !== -1) {
        selectedLabelConfig.values[parentCategoryIndex] = {
          ...selectedLabelConfig.values[parentCategoryIndex],
          id: childId,
          label: newLabel,
        };
      } else {
        selectedLabelConfig.values.push({
          id: childId,
          label: newLabel,
          color,
          text_color,
        });
      }

      return;
    }

    /** Add a new sub-category, if multiple parent categories exist */
    selectedLabelConfig.values.push({
      id: childId,
      label: newLabel,
      color,
      text_color,
    });
  }

  function editCategory(labelConfigKey: string, category: IConfigValue) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === category.id);

    // Editing an existing selectable category
    if (categoryToUpdateIndex >= 0) {
      const existingCategory = selectedLabelConfig.values[categoryToUpdateIndex];

      const newId = existingCategory.id.split("/").slice(0, -1).concat(slugify(category.label)).join("/");

      const duplicateExists = selectedLabelConfig.values.some(
        (cat) => cat.id === newId && cat.id !== existingCategory.id,
      );

      if (duplicateExists) {
        showDuplicateCategoryError(newId);
        return;
      }

      selectedLabelConfig.values[categoryToUpdateIndex] = {
        ...existingCategory,
        ...category,
        label: category.label,
        id: newId,
      };
      return;
    }

    // Editing an intermediate category (update descendants)
    const hasChildren = selectedLabelConfig.values.some((cat) => cat.id.startsWith(category.id + "/"));

    if (hasChildren) {
      const slugifiedLabel = slugify(category.label);
      const parentPrefix = category.id.split("/").slice(0, -1).join("/");

      const childUpdates = selectedLabelConfig.values
        .filter((cat) => cat.id.startsWith(category.id + "/"))
        .map((cat) => {
          const suffix = cat.id.slice(category.id.length);

          return {
            oldId: cat.id,
            newId: `${parentPrefix ? `${parentPrefix}/` : ""}${slugifiedLabel}${suffix}`,
          };
        });

      const existingIds = new SvelteSet(selectedLabelConfig.values.map((cat) => cat.id));

      childUpdates.forEach((update) => {
        existingIds.delete(update.oldId);
      });

      const collision = childUpdates.find((update) => existingIds.has(update.newId));

      if (collision) {
        showDuplicateCategoryError(collision.newId);
        return;
      }

      selectedLabelConfig.values = applyCategoryIdUpdates(selectedLabelConfig.values, childUpdates);
      return;
    }

    selectedLabelConfig.values.push(category);
  }

  function editCategoryId(labelConfigKey: string, oldId: string, newId: string) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];

    const duplicateExists = selectedLabelConfig.values.some((cat) => cat.id === newId && cat.id !== oldId);

    if (duplicateExists) {
      showDuplicateCategoryError(newId);
      return;
    }

    const affectedChildren = selectedLabelConfig.values.filter((cat) => cat.id.startsWith(oldId + "/"));

    const childUpdates = affectedChildren.map((cat) => ({
      oldId: cat.id,
      newId: newId + cat.id.slice(oldId.length),
    }));

    const existingIds = new SvelteSet(selectedLabelConfig.values.map((cat) => cat.id));

    existingIds.delete(oldId);

    childUpdates.forEach((update) => {
      existingIds.delete(update.oldId);
    });

    const collision = childUpdates.find((update) => existingIds.has(update.newId));

    if (collision) {
      showDuplicateCategoryError(collision.newId);
      return;
    }

    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === oldId);

    if (categoryToUpdateIndex >= 0) {
      selectedLabelConfig.values[categoryToUpdateIndex] = {
        ...selectedLabelConfig.values[categoryToUpdateIndex],
        id: newId,
        label: humanize(newId.split("/").at(-1) || "") || "",
      };
    }

    if (childUpdates.length > 0) {
      selectedLabelConfig.values = applyCategoryIdUpdates(selectedLabelConfig.values, childUpdates);
    }
  }

  function changeSelectableCategory(labelConfigKey: string, editedCategory: IConfigValue, selectable: boolean) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const { color, text_color } = getColor({ labelConfigKey });

    if (selectable) {
      const alreadyExists = selectedLabelConfig.values.some((value) => value.id === editedCategory.id);

      if (alreadyExists) {
        return;
      }

      const newEntry: IConfigValue = {
        id: editedCategory.id,
        label: editedCategory.label,
        color,
        text_color,
      };

      // Insert at the correct tree position based on category order map,
      // rather than always pushing to the end.
      const parentPrefix = editedCategory.id.includes("/") ? editedCategory.id.split("/").slice(0, -1).join("/") : "";

      const siblings = getSiblingOrders(parentPrefix);
      const targetOrder = getCategoryOrder(editedCategory.id);

      if (targetOrder !== undefined && siblings.length > 0) {
        let insertIndex = selectedLabelConfig.values.length;

        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].order > targetOrder) {
            const siblingIndex = selectedLabelConfig.values.findIndex((v) => v.id === siblings[i].path);

            if (siblingIndex !== -1) {
              insertIndex = siblingIndex;
              break;
            }
          }
        }

        selectedLabelConfig.values.splice(insertIndex, 0, newEntry);
      } else {
        selectedLabelConfig.values.push(newEntry);
      }
    } else {
      selectedLabelConfig.values = selectedLabelConfig.values.filter((cat) => cat.id !== editedCategory.id);
    }
  }

  function removeCategory(labelConfigKey: string, categoryId: string) {
    if (!labelConfig) return;
    // Filter out the exact category with the given ID
    // If remove children it's still have parent but if remove parent, all children will be removed as well
    const selectedLabelConfig = labelConfig[labelConfigKey];
    if (!selectedLabelConfig) return;

    const normalizedId = categoryId.trim();

    const hasChildren = selectedLabelConfig.values.some((value) => value.id.trim().startsWith(normalizedId + "/"));

    selectedLabelConfig.values = selectedLabelConfig.values.filter((value) => {
      const valueId = value.id.trim();

      // remove self
      if (valueId === normalizedId) return false;

      // remove children (only when deleting parent)
      if (hasChildren && valueId.startsWith(normalizedId + "/")) return false;

      return true;
    });
  }

  function setProperty(labelConfigKey: string, property: IConfigProperty) {
    if (!labelConfig) return;
    const selectedLabelConfig = labelConfig[labelConfigKey];
    const propertyToUpdateIndex = selectedLabelConfig.properties.findIndex((p) => p.id === property.id);
    if (propertyToUpdateIndex >= 0) {
      /** Update existing property */
      let propertyToCreate = property;

      /** If user update the label, update the property.id with slugified label */
      if (propertyToCreate.label !== "New Property") {
        propertyToCreate.id = slugify(propertyToCreate.label);
      }

      selectedLabelConfig.properties[propertyToUpdateIndex] = { ...propertyToCreate };
    } else {
      /** Add new property */
      selectedLabelConfig.properties.push(property);
    }
  }

  function removeProperty(labelConfigKey: string, propertyId: string) {
    if (!labelConfig) return;
    const selectedLabelConfig = labelConfig[labelConfigKey];
    selectedLabelConfig.properties = selectedLabelConfig.properties.filter((p) => p.id !== propertyId);
  }

  function showDuplicateCategoryError(id: string) {
    showToast.error({
      title: "Duplicate category",
      description: `Category "${id}" already exists.`,
    });
  }

  function applyCategoryIdUpdates(values: IConfigValue[], childUpdates: { oldId: string; newId: string }[]) {
    const updateMap = new Map(childUpdates.map((update) => [update.oldId, update.newId]));

    return values.map((cat) => {
      const newId = updateMap.get(cat.id);

      return newId
        ? {
            ...cat,
            id: newId,
          }
        : cat;
    });
  }
</script>

{#await fetchData()}
  <PageLoading />
{:then _}
  <PageHeader title="Label">
    {#snippet slotTitle()}
      <div>
        <LabelConfigTemplateDropdownMenu />
      </div>
    {/snippet}

    {#snippet actions()}
      <Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
        <Button
          class="ml-auto"
          loading={saving}
          loadingLabel="Saving"
          disabled={!hasUnsavedChanges}
          onclick={saveLabelConfigChanges}
        >
          <SaveIcon />
          {hasUnsavedChanges ? "Save Changes" : "Saved"}
        </Button>
      </Can>
    {/snippet}
  </PageHeader>

  <LabelConfigEditor
    {modality}
    {shapes}
    {labelConfig}
    onAddLabelConfig={addLabelConfig}
    onDuplicateConfig={duplicateConfig}
    onRemoveLabelConfig={removeLabelConfig}
    onAddCategory={addCategory}
    onEditCategoryId={editCategoryId}
    onEditCategory={editCategory}
    onChangeSelectableCategory={changeSelectableCategory}
    onRemoveCategory={removeCategory}
    onSetProperty={setProperty}
    onRemoveProperty={removeProperty}
  />
{/await}
