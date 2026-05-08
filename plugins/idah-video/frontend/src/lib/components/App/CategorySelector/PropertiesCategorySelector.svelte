<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";

  import PropertySelector from "$lib/components/App/PropertySelector/PropertySelector.svelte";

  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

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
        .filter(([shapeType, _]) => shapeType != "entry:root")
        .map(([shapeType, { values }]) => [shapeType, values]),
    ),
  );
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined,
  );
  let defaultMode = $derived(mode == "default" || !tools.has(mode));

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup class="p-3">
      <SidebarGroupContent>
        {#key [annotationValue, mode, $entryRoot?.value.category]}
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
              categorySelection(defaultMode ? "entry:root" : mode, selectedCategoryId)}
            onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
            onEditValue={(value) => value && onEditValue(value, defaultMode ? "entry:root" : mode)}
            disabled={selAnnotation?.locked ||
              (defaultMode || mode == "entry:root" ? !!$entryRoot?.locked : false) ||
              !["annotate", "review"].includes(context.workflowStep)}
          />
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
