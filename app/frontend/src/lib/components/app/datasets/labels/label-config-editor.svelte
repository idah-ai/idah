<script lang="ts">
  import { page } from "$app/state";
  import {
    BoltIcon,
    CopyIcon,
    EllipsisVerticalIcon,
    GripVerticalIcon,
    PlusIcon,
    Trash2Icon,
    WorkflowIcon,
  } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import PropertyCard from "@/components/app/datasets/labels/cards/property-card.svelte";
  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import DuplicateConfigModal from "@/components/app/datasets/labels/overlays/duplicate-config-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import Can from "@/security/can.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ModalityShape, ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig, IConfigProperty, IConfigValue } from "@/plugin/v2/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    modality: string;
    shapes: ModalityShapes;
    labelConfig: IConfig;
    onAddLabelConfig: (labelConfigKey: string) => void;
    onDuplicateConfig: (sourceLabelConfigKey: string, targetLabelConfigKey: string) => void;
    onRemoveLabelConfig: (labelConfigKey: string) => void;
    onReorderShape: (draggedKey: string, targetKey: string, position: "before" | "after") => void;
    onAddCategory: (labelConfigKey: string, nodeId?: string) => void;
    onEditCategoryId: (labelConfigKey: string, oldId: string, newId: string) => void;
    onEditCategory: (labelConfigKey: string, category: IConfigValue) => void;
    onChangeSelectableCategory: (labelConfigKey: string, editedCategory: IConfigValue, selectable: boolean) => void;
    onRemoveCategory: (labelConfigKey: string, categoryId: string) => void;
    onReorderCategory: (
      labelConfigKey: string,
      draggedId: string,
      targetId: string,
      position: "before" | "after",
    ) => void;
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
    onReorderShape,
    onAddCategory,
    onEditCategoryId,
    onEditCategory,
    onChangeSelectableCategory,
    onRemoveCategory,
    onReorderCategory,
    onSetProperty,
    onRemoveProperty,
  }: Props = $props();

  /** Shape keys sorted by their persisted `order` (legacy configs without an
   *  order fall back to their existing key order via the index tie-break). */
  function getOrderedConfigKeys(config: IConfig): string[] {
    return Object.keys(config)
      .map((key, index) => ({ key, index, order: config[key]?.order ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
      .map((e) => e.key);
  }

  // Variables
  let projectId: string = page.params.projectId as string;
  let duplicating = $state(false);
  let openDuplicateConfigModal = $state(false);
  let selectedConfigKey: string = $state(getOrderedConfigKeys(labelConfig)[0]);
  let selectedLabelConfig = $derived(
    labelConfig[selectedConfigKey] ?? labelConfig[getOrderedConfigKeys(labelConfig)[0]] ?? null,
  );

  let orderedConfigKeys = $derived(getOrderedConfigKeys(labelConfig));

  /** Drag-and-drop reorder state for the shape (configuration) list. */
  let shapeDragState = $state<{
    draggedKey: string | null;
    dragOverKey: string | null;
    dropPosition: "before" | "after" | null;
  }>({ draggedKey: null, dragOverKey: null, dropPosition: null });

  const shapeDrag = {
    get draggedKey() {
      return shapeDragState.draggedKey;
    },
    get dragOverKey() {
      return shapeDragState.dragOverKey;
    },
    get dropPosition() {
      return shapeDragState.dropPosition;
    },
    start(key: string) {
      shapeDragState.draggedKey = key;
    },
    over(e: DragEvent, targetKey: string) {
      const dragged = shapeDragState.draggedKey;
      if (!dragged || dragged === targetKey) return;
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      shapeDragState.dragOverKey = targetKey;
      shapeDragState.dropPosition = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
    },
    leave() {
      shapeDragState.dragOverKey = null;
      shapeDragState.dropPosition = null;
    },
    end() {
      shapeDragState.draggedKey = null;
      shapeDragState.dragOverKey = null;
      shapeDragState.dropPosition = null;
    },
    drop(e: DragEvent, targetKey: string) {
      e.preventDefault();
      const dragged = shapeDragState.draggedKey;
      const pos = shapeDragState.dropPosition;
      if (dragged && pos && dragged !== targetKey) {
        onReorderShape(dragged, targetKey, pos);
      }
      shapeDrag.end();
    },
  };
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
            selectedConfigKey = `${modality}:${shapeKey}`;
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
            selectedConfigKey = "entry:root";
          },
        },
      ],
    },
  });

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };

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
      selectedConfigKey = getOrderedConfigKeys(labelConfig).find((k) => k !== key) || "";
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

  function reorderCategory(draggedId: string, targetId: string, position: "before" | "after") {
    onReorderCategory(selectedConfigKey, draggedId, targetId, position);
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

        <Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
          <CardAction>
            <Tooltips align="center">
              {#snippet trigger()}
                <Button
                  variant="secondary"
                  size="icon-sm"
                  loading={duplicating}
                  loadingLabel="Duplicating"
                  onclick={() => (openDuplicateConfigModal = true)}
                >
                  <CopyIcon />
                </Button>
              {/snippet}

              {#snippet content()}
                Duplicate configurations to other datasets
              {/snippet}
            </Tooltips>

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
        {#each orderedConfigKeys as labelConfigKey (labelConfigKey)}
          {@const isSelect = selectedConfigKey === labelConfigKey}
          {@const shapeKey = labelConfigKey.split(":").slice(1).join(":")}
          {@const currentShape = shapes[shapeKey] as ModalityShape}
          {@const labelConfigKeyDisplay = labelConfigKey.split(":").slice(1).join(":").replace(":", " ")}
          <div
            role="listitem"
            class={cn("group/shape relative flex w-full items-center gap-1 rounded-md", {
              "before:bg-primary before:absolute before:inset-x-0 before:-top-px before:z-10 before:h-0.5":
                shapeDrag.dragOverKey === labelConfigKey && shapeDrag.dropPosition === "before",
              "after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:z-10 after:h-0.5":
                shapeDrag.dragOverKey === labelConfigKey && shapeDrag.dropPosition === "after",
              "opacity-50": shapeDrag.draggedKey === labelConfigKey,
            })}
            ondragover={(e) => shapeDrag.over(e, labelConfigKey)}
            ondragleave={shapeDrag.leave}
            ondrop={(e) => shapeDrag.drop(e, labelConfigKey)}
          >
            <Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
              <span
                role="button"
                tabindex="-1"
                aria-label="Drag to reorder configuration"
                draggable="true"
                class="shrink-0 cursor-grab opacity-0 transition-opacity duration-200 group-hover/shape:opacity-100 active:cursor-grabbing"
                ondragstart={(e) => {
                  e.dataTransfer?.setData("text/plain", labelConfigKey);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                  shapeDrag.start(labelConfigKey);
                }}
                ondragend={shapeDrag.end}
              >
                <GripVerticalIcon class="text-muted-foreground size-4" />
              </span>
            </Can>

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
          </div>
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
            onReorderCategory={reorderCategory}
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

<DuplicateConfigModal action="create" {labelConfig} {modality} bind:open={openDuplicateConfigModal} />
