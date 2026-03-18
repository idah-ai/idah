<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/sidebar";

  import CategoryProperties from "$lib/plugin/video-annotation-activity/categoryProperties/categoryProperties.svelte";

  import { DEFAULT_MODE, ENTRY_ROOT } from "$lib/plugin/type";
  import { entryRoot } from "$lib/plugin/video-annotation-activity/idb_store.svelte";
  import { selectedAnnotation } from "$lib/plugin/video-annotation-activity/store";

  import type { IActivityContext, IConfigValue } from "$idah/context/activity-context";
  import type { AnnotationValue } from "$idah/context/annotation-context";

  // Props
  let {
    sidebarWidthRem = 15,
    annotationId,
    annotationValue,
    onEditValue,
    onReSelectCategory,
    context,
    mode,
  }: {
    sidebarWidthRem?: number;
    annotationId?: string;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    context: IActivityContext;
    mode: string;
  } = $props();

  // Variables
  let tools = new Map<string, IConfigValue[]>(
    Object.entries(context.config)
      .filter(([shapeType, _]) => shapeType != ENTRY_ROOT)
      .map(([shapeType, { values }]) => [shapeType, values]),
  );
  let defaultMode = $derived(mode == DEFAULT_MODE || !tools.has(mode));

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        {#key [annotationValue, mode, $entryRoot?.value.category]}
          <CategoryProperties
            mode={defaultMode ? ENTRY_ROOT : mode}
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
              categorySelection(defaultMode ? ENTRY_ROOT : mode, selectedCategoryId)}
            onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
            onEditValue={(value) => value && onEditValue(value, defaultMode ? ENTRY_ROOT : mode)}
            disabled={$selectedAnnotation?.locked ||
              (defaultMode || mode == ENTRY_ROOT ? !!$entryRoot?.locked : false) ||
              !["annotate", "review"].includes(context.workflowStep)}
          />
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
