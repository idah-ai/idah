<script lang="ts">
  import { ChevronRightIcon } from "lucide-svelte";

  import { currentMode } from "$lib/plugin/store/store";
  import { cn } from "$lib/utils";
  import { humanize } from "$lib/utils/string";

  import Button from "$lib/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
  import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from "$lib/components/ui/sidebar";
  import { groupAnnotations } from "$lib/utils/group-annotation.svelte";

  import type { AnnotationGroup } from "$lib/context/annotation-context";
  import type { CategoryDefinition } from "$lib/context/category-context";
  import type { IActivityContext, IConfigValue } from "$lib/context/context";
  import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";
  import type { AnnotationsIndexedDB } from "$lib/plugin/indexedDB";

  // Props
  interface Props {
    view: "sidebar" | "popover";
    db?: AnnotationsIndexedDB;

    modalityShape: string;
    categories: IConfigValue[];

    // onSelectCategory: (category?: string) => void;
    selectedCategory: string | undefined;
    context: IActivityContext;
    // onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<VideoAnnotationObject>) => void;
    // onDeleteAnnotation: (annotation: VideoAnnotationObject) => void;
    // onEditability: (locked: boolean, annotation?: VideoAnnotationObject) => void;
    // onVisibility: (hidden: boolean, annotation?: VideoAnnotationObject) => void;
  }
  let {
    view,
    db,
    modalityShape,
    categories,
    // onSelectCategory,
    selectedCategory,
    context,
    // onSelectAnnotationGroup,
    // onDeleteAnnotation,
    // onEditability,
    // onVisibility,
  }: Props = $props();

  // Variables
  let openCategory = $state(true);
  let currentModeIsSameAsShape = $derived($currentMode == modalityShape);

  // Automatically expand all categories when categories prop changes, but allow manual toggles
  let manualToggleStates = $state<Record<string, boolean>>({});
  let openStates = $derived.by(() => {
    const autoExpanded = ([] as IConfigValue[])
      .concat(...Array.from(categories.values()))
      .reduce<Record<string, boolean>>((acc, category) => {
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

    // if (categories.find((c) => c.id === category.id)) {
    //   onSelectCategory(category.id);
    // }

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
        // currentFrame >= annotation.shape.start &&
        // currentFrame <= annotation.shape.end &&
        annotation.shape.type == modalityShape,
    );
    const filteredGroupedAnnotations = groupAnnotations(filteredAnnotations);

    return {
      groups: filteredGroupedAnnotations,
      count: filteredGroupedAnnotations.length,
    };
  }

  $effect(() => {
    console.log({ categories });
  });
</script>

<SidebarGroup>
  <SidebarGroupContent>
    <Collapsible bind:open={openCategory}>
      <CollapsibleTrigger class="w-full">
        {#snippet child({ props })}
          <Button variant="ghost" class="w-full justify-between">
            <!-- {formatShapeName(modalityShape)} -->
            {modalityShape}
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
          {@render CategoryNode(category, category.nestedCategories, selectedCategory)}
        {/each}
      </CollapsibleContent>
    </Collapsible>
  </SidebarGroupContent>
</SidebarGroup>

{#snippet CategoryNode(
  category: CategoryDefinition,
  subCategories: CategoryDefinition[] | undefined,
  // onSelectCategory: (category?: string) => void,
  selectedCategory: string | undefined,
  parent: string[] = [],
  level: number = 1,
)}
  <Collapsible>
    <CollapsibleTrigger>
      <SidebarMenuItem class="flex h-8 w-full flex-row items-center gap-1">
        <Button variant="ghost" size="icon-sm">
          <ChevronRightIcon />
        </Button>
        {category.name}

        <!-- <VectorSqaureIcon
                color={category.data.color}
                class={cn({
                  hidden: category.requiredNested,
                })}
              /> -->

        <!-- <AnnotationCountBadge class="mr-2" count={1} /> -->
      </SidebarMenuItem>
    </CollapsibleTrigger>

    <CollapsibleContent>
      {#if subCategories}
        {#each subCategories as subCategory (subCategory.id)}
          {@render CategoryNode(
            subCategory,
            subCategory.nestedCategories,
            selectedCategory,
            [...parent, category.id.split("/").slice(parent.length)[0]],
            level + 1,
          )}
        {/each}
      {/if}
    </CollapsibleContent>
  </Collapsible>
{/snippet}
