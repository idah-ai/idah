<script lang="ts">
  import { BoltIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import PropertyCard from "@/components/app/datasets/labels/cards/property-card.svelte";
  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  import { humanize } from "@/utils/string";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
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
    onAddLabelConfig: (labelConfigKey: string) => void;
    onAddCategory: (labelConfigKey: string, nodeId?: string) => void;
    onEditCategoryId: (labelConfigKey: string, oldId: string, newId: string) => void;
    onEditCategory: (labelConfigKey: string, category: LabelConfigurationValue) => void;
    onRemoveCategory: (labelConfigKey: string, categoryId: string) => void;
    onSetProperty: (labelConfigKey: string, property: LabelConfigurationProperty) => void;
    onRemoveProperty: (labelConfigKey: string, propertyId: string) => void;
  }
  let {
    modality,
    labelConfig,
    shapes,
    onAddLabelConfig,
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

  let labelConfigMenus: IDropdownMenus = $derived({
    shapes: {
      label: "Shapes",
      items: Object.entries(shapes).map(([shapeKey, shape]) => {
        return {
          label: shape.label,
          disabled: Object.keys(labelConfig).includes(`${modality}:${shapeKey}`),
          action: () => {
            onAddLabelConfig(`${modality}:${shapeKey}`);
          },
        };
      }),
    },
    entry: {
      label: "Entry",
      items: [
        {
          label: "Entry Root",
          disabled: Object.keys(labelConfig).includes("entry:root"),
          action: () => {
            onAddLabelConfig("entry:root");
          },
        },
      ],
    },
  });

  // Functions
  function selectConfigKey(key: string) {
    selectedConfigKey = key;
  }

  function removeLabelConfig(key: string) {
    delete labelConfig[key];
    if (selectedConfigKey === key) {
      selectedConfigKey = Object.keys(labelConfig)[0] || "";
    }
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
      visibility: true,
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
  <div class="flex w-full lg:max-w-80 lg:min-w-72">
    <Card class="w-full gap-2">
      <CardHeader>
        <CardTitle>Configurations</CardTitle>
        <CardDescription class="text-xs">Select a label configuration to manage</CardDescription>

        <CardAction>
          <DropdownMenus menus={labelConfigMenus} align="end">
            {#snippet trigger({ props })}
              <Button {...props} variant="secondary" size="icon-sm">
                <PlusIcon />
              </Button>
            {/snippet}
          </DropdownMenus>
        </CardAction>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#each Object.keys(labelConfig) as labelConfigKey (labelConfigKey)}
          {@const isSelect = selectedConfigKey === labelConfigKey}
          {@const shapeKey = labelConfigKey.split(":").slice(1).join(":")}
          {@const currentShape = shapes[shapeKey] as ModalityShape}
          {@const labelConfigKeyDisplay = labelConfigKey.split(":").slice(1).join(":").replace(":", " ")}
          <Button
            variant={isSelect ? "default" : "secondary"}
            class="group w-full justify-start"
            onclick={() => selectConfigKey(labelConfigKey)}
          >
            {currentShape ? currentShape.label : humanize(labelConfigKeyDisplay)}

            <Button
              variant="ghost"
              size="icon-sm"
              class="ml-auto opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              onclick={(e) => {
                e.stopPropagation();
                removeLabelConfig(labelConfigKey);
              }}
            >
              <Trash2Icon />
            </Button>
          </Button>
        {:else}
          <ResponseBlock
            title="No Label Configurations Yet"
            description="Add a label configuration to get started"
            icon={BoltIcon}
          >
            {#snippet actions()}{/snippet}
          </ResponseBlock>
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
