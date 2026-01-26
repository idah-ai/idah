<script lang="ts">
  import { ChevronRightIcon, CircleSmallIcon, PlusIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from "@/components/ui/sidebar";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";

  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { IConfigValue } from "@/plugin/interface/Activity";

  import AnnotationCountBadge from "./annotation-count-badge.svelte";
  import AnnotationNode from "./category/annotation-node.svelte";
  import CategoryName from "./category/category-name.svelte";
  import VectorSqaureIcon from "./category/vector-sqaure-icon.svelte";

  import { idb_updated_at } from "../../video-annotation-activity/idb_store.svelte";

  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";
  import type { AnnotationsIndexedDB } from "../../video-annotation-activity/indexedDB";

  // Props
  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;
  interface Props {
    db?: AnnotationsIndexedDB;

    currentFrame: number;
    currentMode: string;

    modalityShape: string;
    categories: IConfigValue[];

    onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;

    selectedAnnotationId: string | undefined;
    onSelectAnnotation: (annotation: TAnnotationObj) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj) => void;
    onLock: (locked: boolean, annotation?: TAnnotationObj) => void;
    onVisibility: (hidden: boolean, annotation?: TAnnotationObj) => void;
  }
  let {
    db,
    currentFrame,
    currentMode,
    modalityShape,
    categories,
    onSelectCategory,
    selectedCategory,
    selectedAnnotationId,
    onSelectAnnotation,
    onDeleteAnnotation,
    onLock,
    onVisibility,
  }: Props = $props();

  // Variables
  let forceRender = $state(0);
  let currentModeIsSameAsShape = $derived(currentMode == modalityShape);

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
      }
      // Always set the category itself to true
      acc[category.id] = true;
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

  function buildTree(acc: CategoryDefinition[], ids: string[], configuration: IConfigValue): CategoryDefinition[] {
    let currentLevel = acc;
    let fullPath = "";

    for (let i = 0; i < ids.length; i++) {
      fullPath = i === 0 ? ids[i] : `${fullPath}/${ids[i]}`;

      // find if node exists at this level
      let existingNode = currentLevel.find((current) => current.id === fullPath);
      if (!existingNode) {
        existingNode = {
          id: fullPath,
          name: humanize(ids[i]),
          requiredNested: i < ids.length - 1,
          // only create nestedCategories if this node will have children
          ...(i < ids.length - 1 ? { nestedCategories: [] } : {}),
          data:
            i < ids.length - 1
              ? ({ id: fullPath, label: humanize(ids[i]), color: "#ffff" } as IConfigValue)
              : configuration, // leaf gets real configuration
        };

        currentLevel.push(existingNode);
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

  async function haveAnnotationsInCategory(categoryId: string): Promise<boolean> {
    if (!db || !categoryId) return false;
    const allAnnotations = await db.getAllStartingWith("category", categoryId);
    const filterAnnotations = allAnnotations.filter((annotation) => {
      return (
        currentFrame >= annotation.shape.start &&
        currentFrame <= annotation.shape.end &&
        annotation.shape.type == modalityShape
      );
    });

    return filterAnnotations.length > 0;
  }

  function toggleCategory(e: MouseEvent, category: CategoryDefinition) {
    e.preventDefault();

    // Allow selection if category is not requiredNested,
    // or if it's a parent that exists in the original categories list
    if (categories.find((c) => c.id === category.id)) {
      onSelectCategory(category.id);
    }

    if (category.nestedCategories) {
      // Toggle the category open state manually
      manualToggleStates[category.id] = !openStates[category.id];
    }

    // Force re-render of annotation counts
    forceRender++;
  }

  function getFilteredAnnotations(annotations: Array<TAnnotationObj>): {
    annotations: Array<TAnnotationObj>;
    count: number;
  } {
    const filteredAnnotations = annotations.filter(
      (annotation) =>
        currentFrame >= annotation.shape.start &&
        currentFrame <= annotation.shape.end &&
        annotation.shape.type == modalityShape,
    );

    return {
      annotations: filteredAnnotations,
      count: filteredAnnotations.length,
    };
  }
</script>

<SidebarGroup>
  <SidebarGroupContent>
    {@const openCategoryByDefault = true}
    <Collapsible open={openCategoryByDefault}>
      <CollapsibleTrigger>
        <!-- SHAPE NAME -->
        <Text size="sm" weight="semibold" class="text-secondary-foreground cursor-pointer">
          {formatShapeName(modalityShape)}
        </Text>
      </CollapsibleTrigger>

      <CollapsibleContent class="pt-2">
        <div class="flex items-center gap-2">
          <Text size="xs" weight="semibold" class="text-muted-foreground">Categories</Text>

          {#key $idb_updated_at}
            {#await db?.getAllIndex("category") then annotations}
              <!-- Filter annotations that are within the current frame and have the same shape type -->
              {@const filteredAnnotationsCount =
                annotations?.filter(
                  (annotation) =>
                    currentFrame >= annotation.shape.start &&
                    currentFrame <= annotation.shape.end &&
                    annotation.shape.type == modalityShape,
                ).length || 0}

              <AnnotationCountBadge>{filteredAnnotationsCount}</AnnotationCountBadge>
            {/await}
          {/key}
        </div>

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
  <Collapsible open={currentModeIsSameAsShape ? !!category : openStates[category.id] || false}>
    {#key `${forceRender}-${$idb_updated_at}-${modalityShape}`}
      {#await haveAnnotationsInCategory(category.id) then hasAnnoations}
        <CollapsibleTrigger
          class={cn("text-secondary-foreground flex w-full rounded-md text-xs", {
            "bg-secondary border-1 border-primary": selectedCategory == category.id,
            "hover:bg-primary-foreground hover:dark:bg-accent cursor-pointer": !category.requiredNested,
            "hover:bg-accent cursor-pointer": !currentModeIsSameAsShape,
          })}
          onclick={(e) => toggleCategory(e, category)}
        >
          <div class="flex w-full items-center" style:margin-left="{level - 1}rem">
            <SidebarMenuItem class="flex h-8 w-full flex-row items-center gap-1">
              {@const hasChildren = !!category.nestedCategories || hasAnnoations || false}

              <!-- Only display the button if there are children or annotations -->

              <Button
                variant="ghost"
                size="icon-sm"
                class={cn("", {
                  "opacity-0": !hasChildren || selectedAnnotationId,
                  hidden: currentModeIsSameAsShape && selectedAnnotationId,
                })}
              >
                {@const isSelected = selectedCategory == category.id}

                {#if isSelected && currentModeIsSameAsShape && !selectedAnnotationId}
                  <PlusIcon class="text-primary" strokeWidth={4} />
                {:else if !category.nestedCategories && currentModeIsSameAsShape && !selectedAnnotationId}
                  <CircleSmallIcon class="fill-gray-400 stroke-gray-400" />
                {:else}
                  {@const parentOpen = category.nestedCategories && currentModeIsSameAsShape}
                  <ChevronRightIcon
                    class={cn("", {
                      "opacity-0": !hasChildren,
                      "rotate-90": openStates[category.id] || parentOpen,
                      "stroke-blue-300": isSelected,
                      "stroke-gray-500": !isSelected,
                    })}
                  />
                {/if}
              </Button>

              <VectorSqaureIcon
                color={category.data.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              />

              <CategoryName>{category.name}</CategoryName>

              {#if db && category}
                {#key $idb_updated_at}
                  {#await db.getAllStartingWith("category", category.id) then annotations}
                    {@const { count } = getFilteredAnnotations(annotations)}
                    <AnnotationCountBadge>{count}</AnnotationCountBadge>
                  {/await}
                {/key}
              {/if}
            </SidebarMenuItem>
          </div>
        </CollapsibleTrigger>
      {/await}
    {/key}

    <CollapsibleContent hidden={!openStates[category.id]}>
      {#key $idb_updated_at}
        {#if !currentModeIsSameAsShape && db && category}
          {#await db.getAllIndex("category", category.id) then annotations}
            {@const { annotations: filteredAnnotations } = getFilteredAnnotations(annotations)}

            {#each filteredAnnotations as annotation, annotationIndex (annotation.metadata.id)}
              <AnnotationNode
                name="{category.name}_{annotationIndex}"
                {annotation}
                level={level + 1}
                {onSelectAnnotation}
                {onVisibility}
                {onLock}
                {onDeleteAnnotation}
              />
            {/each}
          {/await}
        {/if}
      {/key}

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
  </Collapsible>
{/snippet}
