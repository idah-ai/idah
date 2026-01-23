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

  import { idb_updated_at } from "../../video-annotation-activity/idb_store.svelte";

  import type { AnnotationsIndexedDB } from "../../video-annotation-activity/indexedDB";

  // Props
  interface Props {
    db?: AnnotationsIndexedDB;

    currentFrame: number;
    currentMode: string;

    modalityShape: string;
    categories: IConfigValue[];

    onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;

    selectedAnnotationId: string | undefined;
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
  }: Props = $props();
  $inspect({ categories });

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
              ? ({ id: fullPath, label: humanize(ids[i]), color: "#ffff", description: "" } as IConfigValue)
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
)}
  <Collapsible open={currentModeIsSameAsShape ? !!category : openStates[category.id] || false}>
    {#key `${forceRender}-${$idb_updated_at}-${modalityShape}`}
      {#await haveAnnotationsInCategory(category.id) then hasAnnoations}
        <CollapsibleTrigger
          class={cn("text-secondary-foreground flex w-full items-center rounded-md text-xs", {
            "bg-secondary border-1 border-primary": selectedCategory == category.id,
            "hover:bg-primary-foreground hover:dark:bg-accent cursor-pointer": !category.requiredNested,
            "hover:bg-accent cursor-pointer": !currentModeIsSameAsShape,
          })}
          onclick={(e) => toggleCategory(e, category)}
        >
          <SidebarMenuItem class="flex w-full flex-row items-center">
            {@const hasChildren = !!category.nestedCategories || hasAnnoations || false}
            <!-- ICON:: CHEVRON, PLUS, VECTOR SQUARE -->
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
                    "rotate-90": open || parentOpen,
                    "stroke-blue-300": isSelected,
                    "stroke-gray-500": !isSelected,
                  })}
                />
              {/if}
            </Button>

            <!-- ??? -->
            <svg
              class={cn("", {
                hidden: category.requiredNested,
              })}
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
                stroke={category.data.color || "var(--color-gray-500)"}
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            {@render CategoryName(category.name)}

            <!-- BADGE::ANNOTATION COUNT -->
            {#if db && category}
              {#key $idb_updated_at}
                {#await db.getAllStartingWith("category", category.id) then anns}
                  {@const filteredAnnotationsCount = anns.filter(
                    (annotation) =>
                      currentFrame >= annotation.shape.start &&
                      currentFrame <= annotation.shape.end &&
                      annotation.shape.type == modalityShape,
                  ).length}

                  <AnnotationCountBadge>{filteredAnnotationsCount}</AnnotationCountBadge>
                {/await}
              {/key}
            {/if}
          </SidebarMenuItem>
        </CollapsibleTrigger>
      {/await}
    {/key}

    <CollapsibleContent></CollapsibleContent>
  </Collapsible>
{/snippet}

{#snippet CategoryName(name: string)}
  <div class="truncate whitespace-nowrap">{name}</div>
{/snippet}
