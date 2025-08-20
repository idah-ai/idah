<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
  } from "@/components/ui/sidebar";

  import { humanize } from "@/utils/string";
  import { BoxSelectIcon, ChevronRightIcon, LassoIcon } from "@lucide/svelte";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { CategoriesDefinition, CategoryDefinition } from "@/context/ActivityContext";
  import {
    videoModes,
    type VideoAnnotation,
    type VideoMode,
  } from "@/components/video-annotation-activity/VideoAnnotationContext";

  interface Props {
    annotationType: string;
    annotations: VideoAnnotation[];
    categories: CategoriesDefinition;
    currentFrame: number;
    selectedAnnotationValue: AnnotationValue;
    showCount?: boolean;
    onSelectSubCategory: (params: { selectedMode: VideoMode; annotationValue: AnnotationValue }) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
  }
  let {
    annotationType,
    annotations,
    categories,
    currentFrame,
    selectedAnnotationValue,
    showCount = false,
    onSelectSubCategory,
    onSelectAnnotation,
  }: Props = $props();

  // Types
  interface AnnotationSidebarCollapsibleCategoryProps {
    categoryName: string;
    subCategories: CategoryDefinition[] | undefined;
    parent?: string[];
    showCount?: boolean;
  }

  // Variables

  // Functions
  function getCategoryFullName(parent: string[], categoryName: string): string {
    return [...parent, categoryName].join("/");
  }

  function getAnnotationsByCategory(parent: string[], categoryName: string): VideoAnnotation[] {
    return annotations.filter(
      (annotation) =>
        annotation.value.category?.startsWith(getCategoryFullName(parent, categoryName)) &&
        currentFrame >= annotation.shape.start &&
        currentFrame <= annotation.shape.end,
    );
  }

  function selectSubCategory(params: { selectedMode: string; selectedCategory: string }) {
    const { selectedMode, selectedCategory } = params;
    const videoMode = videoModes.find((mode) => mode === selectedMode);
    const mode = videoMode ? videoMode : ("view" as VideoMode);
    const newAnnotationValue: AnnotationValue = { ...selectedAnnotationValue, category: selectedCategory };

    onSelectSubCategory({ selectedMode: mode, annotationValue: newAnnotationValue });
  }

  function selectAnnotation(annotation: VideoAnnotation): void {
    onSelectAnnotation(annotation);
  }

  function isSelectedAnnotationIsInCategory(subCategories: CategoryDefinition[] | undefined): boolean {
    if (!subCategories) return false;

    if (!selectedAnnotationValue.category) return false;

    return Object.values(subCategories).some((subCategory) => subCategory.name == selectedAnnotationValue.category);
  }

  function isSelectedAnnotationIsInSubCategory(parent: string[], categoryName: string): boolean {
    if (!selectedAnnotationValue.category) return false;

    return getCategoryFullName(parent, categoryName).split("/").includes(selectedAnnotationValue.category);
  }
</script>

{#snippet AnnotationSidebarCollapsibleCategoryCount(count: number)}
  <Badge variant="outline" class="size-6 rounded-full">{count}</Badge>
{/snippet}

{#snippet AnnotationSidebarCollapsibleCategory(params: AnnotationSidebarCollapsibleCategoryProps)}
  {@const { categoryName, subCategories, parent = [], showCount } = params}
  {@const annotationsByCategory = getAnnotationsByCategory(parent, categoryName)}

  {#if subCategories?.length}
    <Collapsible open={isSelectedAnnotationIsInCategory(subCategories)} class="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger>
          <SidebarGroupLabel>
            {humanize(categoryName)}

            <div class="ml-auto inline-flex items-center gap-2">
              {#if showCount}
                {@render AnnotationSidebarCollapsibleCategoryCount(annotationsByCategory.length)}
              {/if}

              <ChevronRightIcon
                class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
              />
            </div>
          </SidebarGroupLabel>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarGroupContent>
            {#each subCategories as subCategory}
              {@render AnnotationSidebarCollapsibleCategory({
                categoryName: subCategory.name,
                subCategories: subCategory.nestedCategories,
                parent: [...parent, categoryName],
                showCount,
              })}
            {/each}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  {:else}
    <Collapsible open={isSelectedAnnotationIsInSubCategory(parent, categoryName)} class="group/subCollapsible">
      <SidebarMenuSub>
        <CollapsibleTrigger>
          <SidebarMenuItem>
            <SidebarMenuButton
              class="w-full"
              onclick={() => selectSubCategory({ selectedMode: annotationType, selectedCategory: categoryName })}
            >
              {#if annotationType === "bounding-box"}
                <BoxSelectIcon class="size-4" />
              {:else}
                <LassoIcon class="size-4" />
              {/if}

              {humanize(categoryName)}

              <div class="ml-auto inline-flex items-center gap-2">
                {#if showCount}
                  {@render AnnotationSidebarCollapsibleCategoryCount(annotationsByCategory.length)}
                {/if}

                <ChevronRightIcon
                  class="size-4 transition-transform duration-200 group-data-[state=open]/subCollapsible:rotate-90"
                />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {#each annotationsByCategory as annotation, annotationIndex}
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton onclick={() => selectAnnotation(annotation)}>
                  {annotation.value.label || `${humanize(categoryName)}_${annotationIndex + 1}`}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          {/each}
        </CollapsibleContent>
      </SidebarMenuSub>
    </Collapsible>
  {/if}
{/snippet}

{#each Object.entries(categories) as [categoryName, category]}
  {@render AnnotationSidebarCollapsibleCategory({ categoryName, subCategories: category, showCount })}
{/each}
