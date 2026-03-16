<script lang="ts">
  import { ChevronRightIcon } from "@lucide/svelte";

  import { Button } from "$lib/components/ui/button";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
  import { SidebarGroup, SidebarGroupContent } from "$lib/components/ui/sidebar";

  import { cn } from "$lib/utils";
  // import { humanize } from "$lib/utils/string";

  // import type { CategoryDefinition } from "$lib/context/ActivityContext";
  // import type { IConfigValue } from "$lib/plugin/interface/Activity";

  // import AnnotationCountBadge from "./annotation-count-badge.svelte";
  // import AnnotationGroupNode from "./category/annotation-group-node.svelte";
  // import CategoryName from "./category/category-name.svelte";
  // import VectorSqaureIcon from "./category/vector-sqaure-icon.svelte";

  // import { groupAnnotations } from "../../video-annotation-activity/group-annotation.svelte";
  // import { idb_updated_at } from "../../video-annotation-activity/idb_store.svelte";
  // import { selectedAnnotation } from "../../video-annotation-activity/store";

  // import type { AnnotationsIndexedDB } from "../../video-annotation-activity/indexedDB";

  // import type {
  //     AnnotationGroup,
  //     AnnotationMetadata,
  //     AnnotationObj,
  //     AnnotationShape,
  //     AnnotationValue,
  // } from "$lib/context/AnnotationContext";

  // Props
  // type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;
  // interface Props {
  //   view: "sidebar" | "popover";
  //   db?: AnnotationsIndexedDB;

  //   currentFrame: number;
  //   currentMode: string;

  //   modalityShape: string;
  //   categories: IConfigValue[];

  //   onSelectCategory: (category?: string) => void;
  //   selectedCategory: string | undefined;

  //   onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<TAnnotationObj>) => void;
  //   onDeleteAnnotation: (annotation: TAnnotationObj) => void;
  //   onLock: (locked: boolean, annotation?: TAnnotationObj) => void;
  //   onVisibility: (hidden: boolean, annotation?: TAnnotationObj) => void;
  // }
  // let {
  //   view,
  //   db,
  //   currentFrame,
  //   currentMode,
  //   modalityShape,
  //   categories,
  //   onSelectCategory,
  //   selectedCategory,
  //   onSelectAnnotationGroup,
  //   onDeleteAnnotation,
  //   onLock,
  //   onVisibility,
  // }: Props = $props();

  // Variables
  let openCategory = $state(true);
  // let currentModeIsSameAsShape = $derived(currentMode == modalityShape);

  // // Automatically expand all categories when categories prop changes, but allow manual toggles
  // let manualToggleStates = $state<Record<string, boolean>>({});
  // let openStates = $derived.by(() => {
  //   const autoExpanded = categories.reduce<Record<string, boolean>>((acc, category) => {
  //     if (category.id.includes("/")) {
  //       const parts = category.id.split("/");
  //       for (let i = 0; i < parts.length - 1; i++) {
  //         const parentPath = parts.slice(0, i + 1).join("/");
  //         acc[parentPath] = true;
  //       }
  //     }
  //     // Always set the category itself to true
  //     acc[category.id] = true;
  //     return acc;
  //   }, {});

  //   // Merge with manual toggles (manual toggles take precedence)
  //   return { ...autoExpanded, ...manualToggleStates };
  // });

  // // Functions
  // function formatShapeName(shape: string) {
  //   return humanize(shape.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "));
  // }

  // let categoriesTree = $derived(
  //   categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
  //     return buildTree(acc, category_configuration.id.split("/"), category_configuration);
  //   }, []),
  // );

  // function buildTree(acc: CategoryDefinition[], ids: string[], configuration: IConfigValue): CategoryDefinition[] {
  //   let currentLevel = acc;
  //   let fullPath = "";

  //   for (let i = 0; i < ids.length; i++) {
  //     fullPath = i === 0 ? ids[i] : `${fullPath}/${ids[i]}`;

  //     // find if node exists at this level
  //     let existingNode = currentLevel.find((current) => current.id === fullPath);
  //     if (!existingNode) {
  //       existingNode = {
  //         id: fullPath,
  //         name: humanize(ids[i]),
  //         requiredNested: i < ids.length - 1,
  //         // only create nestedCategories if this node will have children
  //         ...(i < ids.length - 1 ? { nestedCategories: [] } : {}),
  //         data:
  //           i < ids.length - 1
  //             ? ({ id: fullPath, label: humanize(ids[i]), color: "#ffff" } as IConfigValue)
  //             : configuration, // leaf gets real configuration
  //       };

  //       currentLevel.push(existingNode);
  //     }

  //     // go deeper only if not a leaf
  //     if (i < ids.length - 1) {
  //       if (!existingNode.nestedCategories) existingNode.nestedCategories = [];
  //       currentLevel = existingNode.nestedCategories;
  //     } else {
  //       // leaf node: overwrite name, description, requiredNested, data
  //       existingNode.name = humanize(configuration.label);
  //       existingNode.description = configuration.description;
  //       existingNode.requiredNested = false;
  //       existingNode.data = configuration;
  //     }
  //   }

  //   return acc;
  // }

  // function toggleCategory(e: MouseEvent, category: CategoryDefinition) {
  //   e.preventDefault();

  //   if (categories.find((c) => c.id === category.id)) {
  //     onSelectCategory(category.id);
  //   }

  //   if (category.nestedCategories) {
  //     manualToggleStates = {
  //       ...manualToggleStates,
  //       [category.id]: !openStates[category.id],
  //     };
  //   }
  // }

  // function groupFilteredAnnotations(annotations: Array<TAnnotationObj>): {
  //   groups: Array<AnnotationGroup<TAnnotationObj>>;
  //   count: number;
  // } {
  //   const filteredAnnotations = annotations.filter(
  //     (annotation) =>
  //       currentFrame >= annotation.shape.start &&
  //       currentFrame <= annotation.shape.end &&
  //       annotation.shape.type == modalityShape,
  //   );
  //   const filteredGroupedAnnotations = groupAnnotations(filteredAnnotations);

  //   return {
  //     groups: filteredGroupedAnnotations,
  //     count: filteredGroupedAnnotations.length,
  //   };
  // }
</script>

<SidebarGroup>
  <SidebarGroupContent>
    <Collapsible bind:open={openCategory}>
      <CollapsibleTrigger class="w-full">
        <!-- {#snippet child({ props })} -->
        <Button variant="ghost" class="w-full justify-between">
          <!-- {formatShapeName(modalityShape)} -->
          formatShapeName
          <div
            class={cn("rotate-0 transition-transform duration-200", {
              "rotate-90": openCategory,
            })}
          >
            <ChevronRightIcon />
          </div>
        </Button>
        <!-- {/snippet} -->
      </CollapsibleTrigger>

      <CollapsibleContent>
        <!-- CATEGORY TREE -->
        <!-- {#each categoriesTree as category (category.id)}
          {@render CategoryNode(category, category.nestedCategories, onSelectCategory, selectedCategory)}
        {/each} -->
      </CollapsibleContent>
    </Collapsible>
  </SidebarGroupContent>
</SidebarGroup>
