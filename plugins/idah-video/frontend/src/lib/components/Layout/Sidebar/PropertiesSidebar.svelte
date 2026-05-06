<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";

  import PropertySelector from "$lib/components/App/PropertySelector/PropertySelector.svelte";

  import { DEFAULT_MODE, ENTRY_ROOT } from "$lib/plugin/type";
  import { entryRoot } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import { currentMode, selectedAnnotation } from "$lib/plugin/video-annotation-activity/store/store";

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
  }: {
    sidebarWidthRem?: number;
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

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup class="p-3">
      <SidebarGroupContent>
        {#key [annotationValue, $currentMode, $entryRoot?.value.category]}
          <PropertySelector
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
