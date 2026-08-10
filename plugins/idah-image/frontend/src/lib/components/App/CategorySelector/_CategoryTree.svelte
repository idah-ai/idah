<script lang="ts">
  import { ChevronRightIcon, CircleSmallIcon, PlusIcon } from "@lucide/svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/Collapsible";
  import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from "$lib/components/ui/Sidebar";

  import { cn } from "$lib/utils";
  import { humanize } from "$lib/utils/string";

  import AnnotationCountBadge from "$lib/components/App/CategorySelector/_AnnotationCountBadge.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import CategoryName from "$lib/components/App/CategorySelector/Category/_CategoryName.svelte";
  import Icon from "$lib/components/ui/Icon";
  import ConfirmModal from "$lib/components/ui/Overlays/modals/ConfirmModal.svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";
  import circleIconSvg from "$lib/assets/icons/circle.svg?raw";
  import ellipseIconSvg from "$lib/assets/icons/ellipse.svg?raw";
  import lineIconSvg from "$lib/assets/icons/minimize-2.svg?raw";
  import squareDashedIconSvg from "$lib/assets/icons/square-dashed.svg?raw";

  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import {
    DEFAULT_MODE,
    IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX,
    IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE,
    IMAGE_ELLIPSE as IDAH_IMAGE_ELLIPSE,
    IMAGE_LINE as IDAH_IMAGE_LINE,
    IMAGE_MASK,
    IMAGE_POLYGON as IDAH_IMAGE_POLYGON,
  } from "$lib/types";

  import { deleteCategoryAnnotations, getCategoryActions } from "$lib/components/App/CategorySelector/menus";

  import type { IConfigValue } from "$idah/v2/types";
  import type { AnnotationItem, DataStore } from "$lib/state/data.svelte";
  import type { IImageAnnotationRecord } from "$lib/types";

  /** Map shape types to their icon SVGs — single source of truth. */
  const shapeIconSrc: Record<string, string> = {
    [IDAH_IMAGE_BOUNDING_BOX]: vectorSquareIconSvg,
    [IDAH_IMAGE_POLYGON]: polygonIconSvg,
    [IDAH_IMAGE_CIRCLE]: circleIconSvg,
    [IDAH_IMAGE_ELLIPSE]: ellipseIconSvg,
    [IDAH_IMAGE_LINE]: lineIconSvg,
    [IMAGE_MASK]: squareDashedIconSvg,
  };

  type CategoryDefinition = IConfigValue & {
    id: string;
    name: string;
    description?: string;
    requiredNested?: boolean;
    nestedCategories?: CategoryDefinition[];
    isExpanded?: boolean;
    count?: number;
    data?: IConfigValue;
  };

  // Props
  interface Props {
    view: "sidebar" | "popover";
    db?: DataStore<AnnotationItem> | null;
    items: IImageAnnotationRecord[];

    modalityShape: string;
    categories: IConfigValue[];

    onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;

    onDeleteAnnotation: (annotation: IImageAnnotationRecord) => void;
  }
  let { view, db, items, modalityShape, categories, onSelectCategory, selectedCategory, onDeleteAnnotation }: Props =
    $props();

  // Variables
  let openCategory = $state(true);
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(selection.value);
  let currentModeIsSameAsShape = $derived(mode == modalityShape && !selAnnotation);
  let usedMaskCategories = $derived(
    new Set(
      items
        .filter((a) => a.shape.type === IMAGE_MASK)
        .map((a) => a.value?.category)
        .filter(Boolean),
    ),
  );

  // Automatically expand all categories when categories prop changes, but allow manual toggles
  let manualToggleStates = $state<Record<string, boolean>>({});
  let openStates = $derived.by(() => {
    const autoExpanded = categories.reduce<Record<string, boolean>>((acc, category) => {
      if (category.id.includes("/")) {
        const parts = category.id.split("/");
        for (let i = 0; i < parts.length - 1; i++) {
          const parentPath = parts.slice(0, i + 1).join("/");
          acc[parentPath] = true;
        }
      } else {
        // Set last level categories to false by default (only parent categories are auto-expanded)
        acc[category.id] = false;
      }
      return acc;
    }, {});

    // Merge with manual toggles (manual toggles take precedence)
    return { ...autoExpanded, ...manualToggleStates };
  });

  // Functions
  function formatShapeName(shape: string) {
    return humanize(shape.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "));
  }

  let categoriesTree = $derived(
    categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
      return buildTree(acc, category_configuration.id.split("/"), category_configuration);
    }, []),
  );

  let openConfirmCategoryDeleteDialog = $state(false);
  let categoryToDelete = $state<string | null>(null);

  // Functions
  function buildTree(acc: CategoryDefinition[], ids: string[], configuration: IConfigValue): CategoryDefinition[] {
    let currentLevel = acc;
    let fullPath = "";

    for (let i = 0; i < ids.length; i++) {
      fullPath = i === 0 ? ids[i] : `${fullPath}/${ids[i]}`;

      // find if node exists at this level
      let existingNode: CategoryDefinition | undefined = currentLevel.find((current) => current.id === fullPath);
      if (!existingNode) {
        const newNode: CategoryDefinition = {
          id: fullPath,
          name: humanize(ids[i]),
          label: humanize(ids[i]),
          color: "#ffffff",
          text_color: null,
          requiredNested: i < ids.length - 1,
          data:
            i < ids.length - 1
              ? ({
                  id: fullPath,
                  label: humanize(ids[i]),
                  color: "#ffffff",
                  text_color: null,
                } as IConfigValue)
              : configuration,
        };

        // only create nestedCategories if this node will have children
        if (i < ids.length - 1) {
          newNode.nestedCategories = [];
        }

        currentLevel.push(newNode);
        existingNode = newNode;
      }

      // go deeper only if not a leaf
      if (i < ids.length - 1) {
        if (!existingNode.nestedCategories) existingNode.nestedCategories = [];
        currentLevel = existingNode.nestedCategories;
      } else {
        // leaf node: overwrite name, description, requiredNested, data
        existingNode.name = humanize(configuration.label);
        existingNode.description = configuration.description;
        existingNode.requiredNested = false;
        existingNode.data = configuration;
      }
    }

    return acc;
  }

  function toggleCategory(e: MouseEvent, category: CategoryDefinition) {
    e.preventDefault();

    // In popover mode, leaf mask categories already used by another mask annotation are disabled
      if (view === "popover" && modalityShape === IMAGE_MASK && !category.nestedCategories && usedMaskCategories.has(category.id)) {
      return;
    }

    if (categories.find((c) => c.id === category.id)) {
      onSelectCategory(category.id);
    }

    if (category.nestedCategories) {
      manualToggleStates = {
        ...manualToggleStates,
        [category.id]: !openStates[category.id],
      };
    }
  }
</script>

<SidebarGroup>
  <SidebarGroupContent>
    <Collapsible bind:open={openCategory}>
      <CollapsibleTrigger>
        {#snippet child({ props })}
          <Button variant="ghost" class="w-full justify-between" {...props}>
            {formatShapeName(modalityShape)}

            <div
              class={cn("rotate-0 transition-transform duration-200", {
                "rotate-90": openCategory,
              })}
            >
              <ChevronRightIcon />
            </div>
          </Button>
        {/snippet}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <!-- CATEGORY TREE -->
        {#each categoriesTree as category (category.id)}
          {@render CategoryNode(category, category.nestedCategories, onSelectCategory, selectedCategory)}
        {/each}
      </CollapsibleContent>
    </Collapsible>
  </SidebarGroupContent>
</SidebarGroup>

{#snippet CategoryNode(
  category: CategoryDefinition,
  subCategories: CategoryDefinition[] | undefined,
  onSelectCategory: (category?: string) => void,
  selectedCategory: string | undefined,
  parent: string[] = [],
  level: number = 1,
)}
  <Collapsible open={openStates[category.id] || false}>
    {#if db && category}
      {@const annotations = items.filter(
        (a) => a.value?.category?.startsWith(category.id) && a.shape.type === modalityShape,
      )}
      {@const isDisabledMaskInPopover = view === "popover" && modalityShape === IMAGE_MASK && !category.nestedCategories && usedMaskCategories.has(category.id)}

      <CollapsibleTrigger
        title={isDisabledMaskInPopover ? "Already used by another mask on this entry" : undefined}
        class={cn("text-secondary-foreground flex w-full rounded-md text-xs focus-visible:outline-none", {
          "bg-secondary border-primary border": !selAnnotation && selectedCategory == category.id,
          "hover:bg-primary-foreground hover:dark:bg-accent cursor-pointer": !category.requiredNested && !isDisabledMaskInPopover,
          "hover:bg-accent cursor-pointer": !currentModeIsSameAsShape && !isDisabledMaskInPopover,
          "cursor-not-allowed opacity-50": isDisabledMaskInPopover,
        })}
        onclick={(e) => toggleCategory(e, category)}
      >
        <div class="flex w-full items-center" style:padding-left="{level - 1}rem">
          <SidebarMenuItem class="group flex h-8 w-full flex-row items-center gap-1">
            {@const hasChildren = !!category.nestedCategories}
            {@const isSelectingCategory = selectedCategory == category.id}
            {@const showChevronRightIcon = hasChildren}

            <Button
              variant="ghost"
              size="icon-sm"
              disabled={currentModeIsSameAsShape}
              class={cn("p-0", {
                "opacity-0 focus-visible:outline-none": !showChevronRightIcon,
              })}
              onclick={(e) => {
                e.stopPropagation();

                if (category.nestedCategories || showChevronRightIcon) {
                  manualToggleStates = {
                    ...manualToggleStates,
                    [category.id]: !openStates[category.id],
                  };
                }
              }}
            >
              {#if view === "sidebar"}
                {#if currentModeIsSameAsShape && !selAnnotation}
                  <!-- TOOLS::BOUNDING BOX / POLYGON / OTHER SHAPES -->
                  {#if isSelectingCategory}
                    <PlusIcon class="text-primary" strokeWidth={4} />
                  {:else if hasChildren}
                    <ChevronRightIcon
                      class={cn({
                        "rotate-90": openStates[category.id],
                        "stroke-blue-300": isSelectingCategory,
                        "stroke-gray-500": !isSelectingCategory,
                      })}
                    />
                  {:else}
                    <CircleSmallIcon class="fill-gray-400 stroke-gray-400" />
                  {/if}
                {:else}
                  <!-- TOOLS::VISUAL -->
                  <ChevronRightIcon
                    class={cn({
                      "opacity-0": !showChevronRightIcon && !selAnnotation,
                      "rotate-90": openStates[category.id],
                      "stroke-blue-300": isSelectingCategory && !selAnnotation,
                      "stroke-gray-500": !isSelectingCategory || selAnnotation,
                    })}
                  />
                {/if}
              {/if}

              {#if view === "popover"}
                {#if hasChildren}
                  <ChevronRightIcon
                    class={cn({
                      "rotate-90": openStates[category.id],
                    })}
                  />
                {:else}
                  <CircleSmallIcon class="fill-gray-400 stroke-gray-400" />
                {/if}
              {/if}
            </Button>

            <Icon
              src={shapeIconSrc[modalityShape] ?? vectorSquareIconSvg}
              color={category.data?.color}
              class={cn({
                hidden: category.requiredNested,
              })}
            />

            <CategoryName name={category.name} />

            {#if isDisabledMaskInPopover}
              <span class="ml-1 text-[0.625rem] text-red-400 dark:text-red-500">
                Category already in use
              </span>
            {/if}

            <!-- BUTTON::HIDE/SHOW, LOCK/UNLOCK, DROPDOWN ACTIONS -->
            {@const actions = getCategoryActions({
              categoryId: category.id,
              shapeType: modalityShape,
              items: annotations,
              onClickDelete: () => {
                categoryToDelete = category.id;
                openConfirmCategoryDeleteDialog = true;
              },
            })}

            <!-- Icon Actions -->
            <div class="ml-auto flex shrink-0 items-center">
              {#each actions as { label, icon, alwaysShow, disabled, onClick }, index (index)}
                <div class={cn("", alwaysShow ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  <CategoryAction
                    {label}
                    {icon}
                    {disabled}
                    onclick={(e) => {
                      e.stopPropagation();
                      onClick(e);
                    }}
                  ></CategoryAction>
                </div>
              {/each}

              <AnnotationCountBadge
                class={cn("mr-2 ml-1 opacity-0", {
                  "opacity-100": view === "sidebar" && annotations.length > 0,
                })}
                count={annotations.length}
              />
            </div>
          </SidebarMenuItem>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent hidden={!openStates[category.id]}>
        {#if subCategories}
          {#each subCategories as subCategory (subCategory.id)}
            {@render CategoryNode(
              subCategory,
              subCategory.nestedCategories,
              onSelectCategory,
              selectedCategory,
              [...parent, category.id.split("/").slice(parent.length)[0]],
              level + 1,
            )}
          {/each}
        {/if}
      </CollapsibleContent>
    {/if}
  </Collapsible>
{/snippet}

<ConfirmModal
  title="Delete annotations in this category"
  description="Are you sure you want to delete all annotations in this category?"
  onConfirm={() => {
    deleteCategoryAnnotations({ categoryId: categoryToDelete!, shapeType: modalityShape });
    openConfirmCategoryDeleteDialog = false;
    categoryToDelete = null;
  }}
  bind:open={openConfirmCategoryDeleteDialog}
/>
