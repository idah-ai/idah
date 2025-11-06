<script lang="ts">
  import { BoltIcon, PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import PropertyCard from "@/components/app/datasets/labels/cards/property-card.svelte";
  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  import type {
    LabelConfigurationProperty,
    LabelConfigurations,
    LabelConfigurationValue,
  } from "@/data/model/dataset/labels";
  import type { ModalityShape, ModalityShapes } from "@/data/model/setting/plugin/types";

  // Props
  interface Props {
    modality: string;
    shapes: ModalityShapes;
    labelConfig: LabelConfigurations;
    onAddCategory: (labelConfigKey: string, nodeId?: string) => void;
    onEditCategoryId: (labelConfigKey: string, oldId: string, newId: string) => void;
    onEditCategory: (labelConfigKey: string, category: LabelConfigurationValue) => void;
    onRemoveCategory: (labelConfigKey: string, categoryId: string) => void;
    onSetProperty: (labelConfigKey: string, property: LabelConfigurationProperty) => void;
    onRemoveProperty: (labelConfigKey: string, propertyId: string) => void;
  }
  let {
    modality,
    shapes,
    labelConfig,
    onAddCategory,
    onEditCategoryId,
    onEditCategory,
    onRemoveCategory,
    onSetProperty,
    onRemoveProperty,
  }: Props = $props();

  // Variables
  let selectedConfigKey: string = $derived(Object.keys(labelConfig)[0]);
  let selectedLabelConfig = $derived(labelConfig[selectedConfigKey]);
  let labelConfigIsEmpty: boolean = $derived(Object.keys(labelConfig).length === 0);
  let hasAtLeastOneCategory: boolean = $derived(selectedLabelConfig ? selectedLabelConfig.values.length > 0 : false);
  let hasAtLeastOneProperty: boolean = $derived(
    selectedLabelConfig ? selectedLabelConfig.properties.length > 0 : false,
  );

  //
  onMount(() => {
    if (Object.keys(labelConfig).length > 0) {
      labelConfig = labelConfig;
      return;
    }

    // Return combination of modality:shapes
    let modalityShapeLabelConfig: LabelConfigurations = {};
    Object.keys(shapes).forEach((shape) => {
      const configKey = `${modality}:${shape}`;
      modalityShapeLabelConfig[configKey] = {
        values: [],
        properties: [],
      };
    });

    labelConfig = modalityShapeLabelConfig;
  });

  // Functions
  function selectConfigKey(key: string) {
    selectedConfigKey = key;
  }

  function addCategory(nodeId?: string) {
    onAddCategory(selectedConfigKey, nodeId);
  }

  function editCategoryId(oldId: string, newId: string) {
    onEditCategoryId(selectedConfigKey, oldId, newId);
  }

  function editCategory(editedCategory: LabelConfigurationValue) {
    onEditCategory(selectedConfigKey, editedCategory);
  }

  function removeCategory(categoryId: string) {
    onRemoveCategory(selectedConfigKey, categoryId);
  }

  function addNewProperty() {
    onSetProperty(selectedConfigKey, {
      id: `property-${new Date().getTime()}`,
      label: "New Property",
      type: "text",
      description: "",
      required: false,
      format: {
        minimum: null,
        maximum: null,
        step: 1,
        info: null,
        options: [],
      },
      visibility: ["match", [["get", ["value.id"]], "*"]],
    });
  }

  function setProperty(property: LabelConfigurationProperty) {
    onSetProperty(selectedConfigKey, property);
  }

  function removeProperty(propertyId: string) {
    onRemoveProperty(selectedConfigKey, propertyId);
  }
</script>

<section class="flex w-full flex-col gap-2 lg:flex-row">
  <!-- LABEL CONFIG::NAVIGATION -->
  <div class="flex w-full lg:min-w-72 lg:max-w-80">
    <Card class="w-full gap-2">
      <CardHeader>
        <CardTitle>Configurations</CardTitle>
        <CardDescription class="text-xs">Select a label configuration to manage</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#each Object.keys(labelConfig) as labelConfigKey (labelConfigKey)}
          {@const isSelect = selectedConfigKey === labelConfigKey}
          {@const shapeKey = labelConfigKey.split(":")[1]}
          {@const currentShape = shapes[shapeKey] as ModalityShape}
          <Button
            variant={isSelect ? "default" : "secondary"}
            class="w-full justify-start"
            onclick={() => selectConfigKey(labelConfigKey)}
          >
            {currentShape.label}
          </Button>
        {/each}
      </CardContent>
    </Card>
  </div>

  <!-- LABEL CONFIG::CATEGORIES & PROPERTIES -->
  <div class="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-5">
    <!-- CATEGORIES -->
    <Card class="col-span-1 gap-2 lg:col-span-3">
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription class="text-xs">
          Manage the categories for the "{selectedConfigKey}" label configuration
        </CardDescription>

        <CardAction>
          {#if hasAtLeastOneCategory}
            <Button size="sm" onclick={() => addCategory()}>
              <PlusIcon />
              New Category
            </Button>
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent>
        {#if !labelConfigIsEmpty}
          <CategoryTree
            values={selectedLabelConfig.values}
            onAddCategory={(nodeId) => addCategory(nodeId)}
            onEditCategoryId={(oldId, newId) => editCategoryId(oldId, newId)}
            onEditCategory={(editedCategory) => editCategory(editedCategory)}
            onRemoveCategory={(categoryId) => removeCategory(categoryId)}
          />
        {/if}
      </CardContent>
    </Card>

    <!-- PROPERTIES -->
    <Card class="col-span-1 gap-2 md:col-span-2">
      <CardHeader>
        <CardTitle>Properties</CardTitle>
        <CardDescription class="text-xs">Manage the properties</CardDescription>

        <CardAction>
          {#if hasAtLeastOneProperty}
            {@render AddNewPropertyButton()}
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#if !labelConfigIsEmpty}
          {#each Object.values(selectedLabelConfig.properties) as property (property.id)}
            <PropertyCard
              {property}
              onSetProperty={(editedProperty) => setProperty(editedProperty)}
              onRemoveProperty={(propertyId) => removeProperty(propertyId)}
            />
          {:else}
            <ResponseBlock icon={BoltIcon} title="No Properties Yet" description="Create properties to get started">
              {#snippet actions()}
                {@render AddNewPropertyButton()}
              {/snippet}
            </ResponseBlock>
          {/each}
        {/if}
      </CardContent>
    </Card>
  </div>
</section>

{#snippet AddNewPropertyButton()}
  <Button size="sm" onclick={addNewProperty}>
    <PlusIcon />
    New Property
  </Button>
{/snippet}
