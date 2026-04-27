<script lang="ts">
  import { ChevronRightIcon, CircleSmallIcon, PlusIcon } from "lucide-svelte";

  import { currentFrame, currentMode } from "$lib/plugin/store/store";
  import { IMAGE_BOUNDING_BOX, IMAGE_POLYGON } from "$lib/plugin/types";
  import { cn } from "$lib/utils";
  import { groupAnnotations } from "$lib/utils/group-annotation.svelte";
  import { humanize } from "$lib/utils/string";

  import AnnotationCountBadge from "$lib/components/app/sidebar/badge/annotation-count-badge.svelte";
  import ImageAnnotationGroupNode from "$lib/components/app/sidebar/category/image-annotation-group-node.svelte";
  import ImageCategoryName from "$lib/components/app/sidebar/category/image-category-name.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
  import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from "$lib/components/ui/sidebar";

  import PolygonCircleIcon from "$lib/plugin/icon/polygon-circle-icon.svelte";
  import VectorSquareIcon from "$lib/plugin/icon/vector-square-icon.svelte";

  import type { SidebarView } from "$lib/components/app/sidebar/sidebar.types";
  import type { AnnotationGroup } from "$lib/context/annotation-context";
  import type { CategoryDefinition } from "$lib/context/category-context";
  import type { IConfigValue } from "$lib/context/context";
  import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";
  import type { AnnotationBackend } from "$lib/plugin/data/annotation/annotaiton-backend.svelte";

  // Props
  interface Props {
    view: SidebarView;
    db?: AnnotationBackend;
    modalityShape: string;
    categories: IConfigValue[];
    onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<ImageAnnotationObject>) => void;
    onDeleteAnnotation: (annotation: ImageAnnotationObject) => void;
  }
  let {
    view,
    db,
    modalityShape,
    categories,
    onSelectCategory,
    selectedCategory,
    onSelectAnnotationGroup,
    onDeleteAnnotation,
  }: Props = $props();

  // Variables
  let openCategory = $state(true);
  let currentModeIsSameAsShape = $derived($currentMode == modalityShape);

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

      return acc;
    }, {});

    // Merge with manual toggles (manual toggles take precedence)
    return { ...autoExpanded, ...manualToggleStates };
  });

  let categoriesTree = $derived(
    ([] as IConfigValue[])
      .concat(...Array.from(categories.values()))
      .reduce<CategoryDefinition[]>((acc, category_configuration) => {
        return buildTree(acc, category_configuration.id.split("/"), category_configuration);
      }, []),
  );

  // Functions
  function formatShapeName(shape: string) {
    return humanize(shape.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "));
  }

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
              ? ({
                  id: fullPath,
                  label: humanize(ids[i]),
                  color: "#ffff",
                } as IConfigValue)
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

  function toggleCategory(e: MouseEvent, category: CategoryDefinition) {
    e.preventDefault();

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

  function groupFilteredAnnotations(annotations: Array<ImageAnnotationObject>): {
    groups: Array<AnnotationGroup<ImageAnnotationObject>>;
    count: number;
  } {
    const filteredAnnotations = annotations.filter(
      (annotation) =>
        $currentFrame >= annotation.shape.start &&
        $currentFrame <= annotation.shape.end &&
        annotation.shape.type == modalityShape,
    );
    const filteredGroupedAnnotations = groupAnnotations(filteredAnnotations);

    return {
      groups: filteredGroupedAnnotations,
      count: filteredGroupedAnnotations.length,
    };
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
      {@const annotations = db.annotationsForCategory(category.id)}
      {@const { count } = groupFilteredAnnotations(annotations)}
      {@const hasAnnotations = count > 0}

      <CollapsibleTrigger
        class={cn("text-secondary-foreground flex w-full rounded-md text-xs", {
          "bg-secondary border-primary border": selectedCategory == category.id,
          "hover:bg-primary-foreground hover:dark:bg-accent cursor-pointer": !category.requiredNested,
          "hover:bg-accent cursor-pointer": !currentModeIsSameAsShape,
        })}
        onclick={(e) => toggleCategory(e, category)}
      >
        <div class="flex w-full items-center" style:padding-left="{level - 1}rem">
          <SidebarMenuItem class="flex h-8 w-full flex-row items-center gap-1">
            {@const hasChildren = !!category.nestedCategories}
            {@const isSelectingCategory = selectedCategory == category.id}
            {@const showChevronRightIcon = hasChildren || hasAnnotations}

            <Button
              variant="ghost"
              size="icon-sm"
              disabled={currentModeIsSameAsShape}
              class={cn("p-0", {
                "opacity-0": !showChevronRightIcon,
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
                {#if currentModeIsSameAsShape}
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
                      "opacity-0": !showChevronRightIcon,
                      "rotate-90": openStates[category.id],
                      "stroke-blue-300": isSelectingCategory,
                      "stroke-gray-500": !isSelectingCategory,
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

            {#if modalityShape === IMAGE_BOUNDING_BOX}
              <VectorSquareIcon
                color={category.data?.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              />
            {:else if modalityShape === IMAGE_POLYGON}
              <PolygonCircleIcon
                color={category.data?.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              />
            {/if}

            <ImageCategoryName name={category.name} />

            {#if view === "sidebar" && count > 0}
              <AnnotationCountBadge class="mr-2" {count} />
            {/if}
          </SidebarMenuItem>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent hidden={!openStates[category.id]}>
        {#if db && category}
          {@const categoryAnnotations = db.annotationsByCategory(category.id)}
          {@const { groups: filteredAnnotationGroups } = groupFilteredAnnotations(categoryAnnotations)}
          {#each filteredAnnotationGroups as annotationGroup (annotationGroup.groupId)}
            <ImageAnnotationGroupNode
              {category}
              {annotationGroup}
              level={level + 1}
              {onSelectAnnotationGroup}
              {onDeleteAnnotation}
            />
          {/each}
        {/if}

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
