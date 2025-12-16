<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { SaveIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";

  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { humanize, slugify } from "@/utils/string";

  import { labelColors } from "@/data/model/dataset/labels";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig, IConfigProperty, IConfigValue } from "@/plugin/interface/Activity";
  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;

  let saving: boolean = $state(false);
  let modality: string = $state("");
  let shapes = $state<ModalityShapes>({});
  let labelConfig: IConfig = $state({});
  let initialLabelConfig: IConfig | undefined = $state(undefined);
  let isLabelConfigChanged: boolean = $derived.by(() => {
    return JSON.stringify(labelConfig) !== JSON.stringify(initialLabelConfig);
  });

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
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["modality", "labeling_configuration"],
      },
    });
    modality = datasetRes.data.modality;

    const showModalityRes = await pluginsBackendDataSource.showModality(modality);
    shapes = showModalityRes.shapes;

    labelConfig = datasetRes.data.labeling_configuration;
    initialLabelConfig = JSON.parse(JSON.stringify(labelConfig));
  }

  async function saveLabelConfigChanges(): Promise<void> {
    saving = true;
    /**
     * Remove unset config
     */
    const cleanedLabelConfig: IConfig = {};
    Object.entries(labelConfig).forEach(([key, config]) => {
      if (config.values.length > 0 || config.properties.length > 0) {
        cleanedLabelConfig[key] = config;
      }
    });

    try {
      const updatedDatasetRes = await datasetsBackendDataSource.update(datasetId, {
        attributes: {
          labeling_configuration: cleanedLabelConfig,
        },
      });
      initialLabelConfig = JSON.parse(JSON.stringify(updatedDatasetRes.data.labeling_configuration));
      labelConfig = updatedDatasetRes.data.labeling_configuration;
      toast.success("Labeling configuration changes saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save labeling configuration changes.");
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

    labelConfig[targetLabelConfigKey] = JSON.parse(JSON.stringify(labelConfig[sourceLabelConfigKey]));
  }

  function removeLabelConfig(key: string) {
    if (!labelConfig) return;
    labelConfig = Object.fromEntries(
      Object.entries(labelConfig).filter(([labelConfigKey, _]) => labelConfigKey !== key),
    );
  }

  function addCategory(labelConfigKey: string, nodeId?: string) {
    if (!labelConfig) return;

    const currentTime = new Date().getTime().toString();
    const newLabel = "New Category";
    const newId = slugify(currentTime);
    const selectedLabelConfig = labelConfig[labelConfigKey];
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

  function editCategory(labelConfigKey: string, category: IConfigValue) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === category.id);

    if (categoryToUpdateIndex >= 0) {
      /** If the edited category is exactly the same as an existing one */
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
      /** Check if there are any categories with parent ID starts with the edited category's ID */
      if (selectedLabelConfig.values.some((cat) => cat.id.startsWith(category.id + "/"))) {
        /** Update all child categories to reflect the new parent ID */
        selectedLabelConfig.values = selectedLabelConfig.values.map((cat) => {
          if (cat.id.startsWith(category.id + "/")) {
            const suffix = cat.id.slice(category.id.length);
            const slugifiedLabel: string = slugify(category.label);
            const newId = category.id.split("/").slice(0, -1).concat(slugifiedLabel).join("/") + suffix;
            return {
              ...cat,
              id: newId,
            };
          }
          return cat;
        });
      } else {
        selectedLabelConfig.values.push(category);
      }
    }
  }

  function editCategoryId(labelConfigKey: string, oldId: string, newId: string) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const categoryToUpdateIndex = selectedLabelConfig.values.findIndex((cat) => cat.id === oldId);
    if (categoryToUpdateIndex >= 0) {
      selectedLabelConfig.values[categoryToUpdateIndex] = {
        ...selectedLabelConfig.values[categoryToUpdateIndex],
        id: newId,
        /** Update the label to be the last part of the new ID */
        label: humanize(newId.split("/")[newId.split("/").length - 1]) || "",
      };
    }
  }

  function changeSelectableCategory(labelConfigKey: string, editedCategory: IConfigValue, selectable: boolean) {
    if (!labelConfig) return;

    const selectedLabelConfig = labelConfig[labelConfigKey];
    const usedColors = selectedLabelConfig.values.map((cat) => cat.color);
    const availableColors = labelColors.filter((color) => !usedColors.includes(color.color));
    const firstAvailableColor = availableColors[0];

    if (selectable) {
      selectedLabelConfig.values.push({
        id: editedCategory.id,
        label: editedCategory.label,
        color: firstAvailableColor.color,
        text_color: firstAvailableColor.text_color,
      });
    } else {
      selectedLabelConfig.values = selectedLabelConfig.values.filter((cat) => cat.id !== editedCategory.id);
    }
  }

  function removeCategory(labelConfigKey: string, categoryId: string) {
    if (!labelConfig) return;
    // Filter out the exact category with the given ID
    // This will only remove the exact match, keeping any parent categories
    const selectedLabelConfig = labelConfig[labelConfigKey];
    const usedColors = selectedLabelConfig.values.map((cat) => cat.color);
    const availableColors = labelColors.filter((color) => !usedColors.includes(color.color));
    const firstAvailableColor = availableColors[0];

    selectedLabelConfig.values = selectedLabelConfig.values.filter((cat) => !cat.id.includes(categoryId));

    // Check if we need to create a parent category
    const categoryPaths = categoryId.split("/");
    if (categoryPaths.length > 1) {
      // Create the parent path by removing the last segment
      const parentPath = categoryPaths.slice(0, -1).join("/");
      // Check if any existing category starts with the parent path
      const anyExistingCategoryStartsWithParent = selectedLabelConfig.values.some((cat) =>
        cat.id.startsWith(parentPath + "/"),
      );

      // If parent doesn't exist, create it
      if (!anyExistingCategoryStartsWithParent) {
        selectedLabelConfig.values.push({
          id: parentPath,
          label: humanize(parentPath),
          color: firstAvailableColor.color,
          text_color: firstAvailableColor.text_color,
        });
      }
    }
  }

  function setProperty(labelConfigKey: string, property: IConfigProperty) {
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
  <PageLoading />
{:then _}
  <PageHeader title="Label">
    {#snippet slotTitle()}
      <Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
        <Button
          loading={saving}
          loadingLabel="Saving"
          disabled={!isLabelConfigChanged}
          class="ml-auto"
          onclick={saveLabelConfigChanges}
        >
          <SaveIcon />
          {isLabelConfigChanged ? "Save Changes" : "Saved"}
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
