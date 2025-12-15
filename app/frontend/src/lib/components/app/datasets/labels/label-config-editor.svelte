<script lang="ts">
  import { BoltIcon, CopyIcon, EllipsisVerticalIcon, PlusIcon, Trash2Icon, WorkflowIcon } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import PropertyCard from "@/components/app/datasets/labels/cards/property-card.svelte";
  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import Can from "@/security/can.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ModalityShape, ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig, IConfigProperty, IConfigValue } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    modality: string;
    shapes: ModalityShapes;
    labelConfig: IConfig;
    onAddLabelConfig: (labelConfigKey: string) => void;
    onDuplicateConfig: (sourceLabelConfigKey: string, targetLabelConfigKey: string) => void;
    onRemoveLabelConfig: (labelConfigKey: string) => void;
    onAddCategory: (labelConfigKey: string, nodeId?: string) => void;
    onEditCategoryId: (labelConfigKey: string, oldId: string, newId: string) => void;
    onEditCategory: (labelConfigKey: string, category: IConfigValue) => void;
    onChangeSelectableCategory: (labelConfigKey: string, editedCategory: IConfigValue, selectable: boolean) => void;
    onRemoveCategory: (labelConfigKey: string, categoryId: string) => void;
    onSetProperty: (labelConfigKey: string, property: IConfigProperty) => void;
    onRemoveProperty: (labelConfigKey: string, propertyId: string) => void;
  }
  let {
    modality,
    labelConfig,
    shapes,
    onAddLabelConfig,
    onDuplicateConfig,
    onRemoveLabelConfig,
    onAddCategory,
    onEditCategoryId,
    onEditCategory,
    onChangeSelectableCategory,
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

  function getLabelConfigActionMenus(labelConfigKey: string): IDropdownMenus {
    return {
      actions: {
        items: [
          {
            label: "Duplicate configuration to",
            icon: CopyIcon,
            items: {
              shapes: {
                label: "Shapes",
                items: Object.entries(shapes).map(([shapeKey, shape]) => {
                  return {
                    label: shape.label,
                    disabled: labelConfigKey === `${modality}:${shapeKey}`,
                    action: () => {
                      onDuplicateConfig(labelConfigKey, `${modality}:${shapeKey}`);
                    },
                  };
                }),
              },
              entry: {
                label: "Entry",
                items: [
                  {
                    label: "Entry Root",
                    disabled: labelConfigKey === "entry:root",
                    action: () => {
                      onDuplicateConfig(labelConfigKey, "entry:root");
                    },
                  },
                ],
              },
            },
          },
          {
            label: "Remove configuration",
            icon: Trash2Icon,
            action: () => {
              removeLabelConfig(labelConfigKey);
            },
          },
        ],
      },
    };
  }

  // Functions
  function getSelectLabelConfigLabel(selectedLabelConfigKey: string): string {
    if (!selectedLabelConfigKey) return "";

    const shapeKey = selectedLabelConfigKey.split(":").slice(1).join(":");
    const currentShape = shapes[shapeKey] as ModalityShape;
    return currentShape ? `"${currentShape.label}"` : `"${humanize(shapeKey.replace(":", " "))}"`;
  }

  function selectConfigKey(key: string) {
    selectedConfigKey = key;
  }

  function removeLabelConfig(key: string) {
    if (selectedConfigKey === key) {
      selectedConfigKey = Object.keys(labelConfig)[0] || "";
    } else {
      selectedConfigKey = "";
    }

    // delete labelConfig[key];
    onRemoveLabelConfig(key);
  }

  function addCategory(nodeId?: string) {
    onAddCategory(selectedConfigKey, nodeId);
  }

  function editCategoryId(oldId: string, newId: string) {
    onEditCategoryId(selectedConfigKey, oldId, newId);
  }

  function editCategory(editedCategory: IConfigValue) {
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
      format: {},
      visibility: true,
    });
  }

  function setProperty(property: IConfigProperty) {
    onSetProperty(selectedConfigKey, property);
  }

  function changeSelectableCategory(editedCategory: IConfigValue, selectable: boolean) {
    onChangeSelectableCategory(selectedConfigKey, editedCategory, selectable);
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

        <Can action="update" resource="dataset:datasets">
          <CardAction>
            <DropdownMenus menus={labelConfigMenus} align="end">
              {#snippet trigger({ props })}
                <Button {...props} variant="secondary" size="icon-sm">
                  <PlusIcon />
                </Button>
              {/snippet}
            </DropdownMenus>
          </CardAction>
        </Can>
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

            <DropdownMenus menus={getLabelConfigActionMenus(labelConfigKey)} align="end">
              {#snippet trigger({ props })}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  class={cn("ml-auto opacity-0 transition-opacity duration-200 group-hover:opacity-100 ", {
                    "opacity-100": props["data-state"] === "open",
                  })}
                >
                  <EllipsisVerticalIcon />
                </Button>
              {/snippet}
            </DropdownMenus>
          </Button>
        {:else}
          <ResponseBlock
            title="No label configurations Yet"
            description="Add a label configuration to get started"
            icon={BoltIcon}
            size="sm"
          ></ResponseBlock>
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
          Manage the categories for the {getSelectLabelConfigLabel(selectedConfigKey)} label configuration
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
            onAddCategory={addCategory}
            onEditCategoryId={editCategoryId}
            onEditCategory={editCategory}
            onChangeSelectableCategory={changeSelectableCategory}
            onRemoveCategory={removeCategory}
          />
        {:else}
          <ResponseBlock
            title="No categories yet"
            description="Add a label configuration to get started"
            icon={WorkflowIcon}
            size="sm"
          ></ResponseBlock>
        {/if}
      </CardContent>
    </Card>

    <!-- PROPERTIES -->
    <Card class="col-span-1 gap-2 md:col-span-2">
      <CardHeader>
        <CardTitle>Properties</CardTitle>
        <CardDescription class="text-xs">
          Manage the properties for the {getSelectLabelConfigLabel(selectedConfigKey)} label configuration
        </CardDescription>

        <CardAction>
          {#if hasAtLeastOneProperty}
            {@render AddNewPropertyButton()}
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#if !labelConfigIsEmpty}
          {#each Object.values(selectedLabelConfig.properties) as property (property.id)}
            <PropertyCard {property} onSetProperty={setProperty} onRemoveProperty={removeProperty} />
          {:else}
            <ResponseBlock
              icon={BoltIcon}
              title="No properties yet"
              description="Create properties to get started"
              size="sm"
            >
              {#snippet actions()}
                {@render AddNewPropertyButton()}
              {/snippet}
            </ResponseBlock>
          {/each}
        {:else}
          <ResponseBlock
            title="No properties yet"
            description="Add a label configuration to get started"
            icon={BoltIcon}
            size="sm"
          ></ResponseBlock>
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
