<script lang="ts">
  import { ChevronRightIcon, CircleSmallIcon, PlusIcon } from "@lucide/svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/Collapsible";
  import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from "$lib/components/ui/Sidebar";

  import { cn } from "$lib/utils";
  import { humanize } from "$lib/utils/string";

  import Icon from "$lib/components/ui/Icon";
  import AnnotationCountBadge from "$lib/components/App/CategorySelector/_AnnotationCountBadge.svelte";
  import AnnotationGroupNode from "$lib/components/App/CategorySelector/Category/_AnnotationGroupNode.svelte";
  import CategoryName from "$lib/components/App/CategorySelector/Category/_CategoryName.svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$lib/types";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { groupAnnotations } from "$lib/components/App/VideoAnnotationWorkspace/utils/group-annotation.svelte";

  import type { IConfigValue } from "$idah/v2/types";
  import type { IVideoAnnotationRecord } from "$lib/types";
  import type { DataStore, AnnotationItem } from "$lib/state/data.svelte";

  type AnnotationGroup<T> = { groupId: string; annotations: T[] };
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
    items: IVideoAnnotationRecord[];

    modalityShape: string;
    categories: IConfigValue[];

    onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;

    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<IVideoAnnotationRecord>) => void;
    onDeleteAnnotation: (annotation: IVideoAnnotationRecord) => void;
  }
  let {
    view,
    db,
    items,
    modalityShape,
    categories,
    onSelectCategory,
    selectedCategory,
    onSelectAnnotationGroup,
    onDeleteAnnotation,
  }: Props = $props();

  // Variables
  let openCategory = $state(true);
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined,
  );
  let currentModeIsSameAsShape = $derived(mode == modalityShape && !selAnnotation);

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

  function groupFilteredAnnotations(annotations: Array<IVideoAnnotationRecord>): {
    groups: Array<AnnotationGroup<IVideoAnnotationRecord>>;
    count: number;
  } {
    const filteredAnnotations = annotations.filter(
      (annotation) =>
    viewport.video.currentFrame.value >= annotation.shape.start &&
        viewport.video.currentFrame.value <= annotation.shape.end &&
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
      {@const annotations = items.filter((a) => a.value?.category?.startsWith(category.id))}
      {@const { count } = groupFilteredAnnotations(annotations)}
      {@const hasAnnotations = count > 0}

      <CollapsibleTrigger
        class={cn("text-secondary-foreground flex w-full rounded-md text-xs", {
          "bg-secondary border-primary border": !selAnnotation && selectedCategory == category.id,
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

            {#if modalityShape === IDAH_VIDEO_BOUNDING_BOX}
              <Icon
                src={vectorSquareIconSvg}
                color={category.data?.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              />
            {:else if modalityShape === IDAH_VIDEO_POLYGON}
              <Icon
                src={polygonIconSvg}
                color={category.data?.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              />
            {/if}

            <CategoryName name={category.name} />

            {#if view === "sidebar" && count > 0}
              <AnnotationCountBadge class="mr-2" {count} />
            {/if}
          </SidebarMenuItem>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent hidden={!openStates[category.id]}>
        {#if !currentModeIsSameAsShape && db && category}
          {@const categoryAnnotations = items.filter((a) => a.value?.category === category.id)}
          {@const { groups: filteredAnnotationGroups } = groupFilteredAnnotations(categoryAnnotations)}
          {#each filteredAnnotationGroups as annotationGroup (annotationGroup.groupId)}
            <AnnotationGroupNode
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
