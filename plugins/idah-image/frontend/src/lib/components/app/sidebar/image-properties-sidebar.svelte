<script lang="ts">
  import CategoryProperties from "$lib/components/app/sidebar/properties/category-properties.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
  } from "$lib/components/ui/sidebar";

  import { currentMode, selectedAnnotation } from "$lib/plugin/store/store";

  import type { AnnotationValue } from "$lib/context/annotation-context";
  import type { IActivityContext, IConfigValue } from "$lib/context/context";
  import { entryRoot } from "$lib/plugin/store/idb-store.svelte";
  import { DEFAULT_MODE, ENTRY_ROOT } from "$lib/plugin/types";

  // Props
  let {
    annotationId,
    annotationValue,
    onEditValue,
    onReSelectCategory,
    context,
  }: {
    annotationId?: string;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    context: IActivityContext;
  } = $props();

  // Variables
  let tools = $derived(
    new Map<string, IConfigValue[]>(
      Object.entries(context.config)
        .filter(([shapeType, _]) => shapeType != ENTRY_ROOT)
        .map(([shapeType, { values }]) => [shapeType, values]),
    ),
  );
  let defaultMode = $derived($currentMode == DEFAULT_MODE || !tools.has($currentMode));

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="w-full" side="right">
  <SidebarHeader></SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        {#key [annotationValue, $currentMode, $entryRoot?.value.category]}
          <CategoryProperties
            selectedCategory={(defaultMode
              ? annotationValue.category || $entryRoot?.value.category
              : annotationValue.category) || ""}
            {annotationId}
            annotationValue={(defaultMode
              ? Object.keys(annotationValue).length
                ? annotationValue
                : $entryRoot?.value
              : annotationValue) || {}}
            onSelectCategory={(selectedCategoryId) =>
              categorySelection(defaultMode ? ENTRY_ROOT : $currentMode, selectedCategoryId)}
            onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
            onEditValue={(value) => value && onEditValue(value, defaultMode ? ENTRY_ROOT : $currentMode)}
            disabled={$selectedAnnotation?.locked ||
              (defaultMode || $currentMode == ENTRY_ROOT ? !!$entryRoot?.locked : false) ||
              !["annotate", "review"].includes(context.workflowStep)}
          />
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
