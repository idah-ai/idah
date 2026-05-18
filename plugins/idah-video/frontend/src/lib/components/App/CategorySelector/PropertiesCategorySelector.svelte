<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";

  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";

  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";

  import type { IConfigValue } from "$idah/v2/types";
  import type { IVideoAnnotationValue } from "$lib/types";

  // Props
  let {
    sidebarWidthRem = 15,
    annotationId,
    annotationValue,
    onEditValue,
    onReSelectCategory,
  }: {
    sidebarWidthRem?: number;
    annotationId?: string;
    annotationValue: IVideoAnnotationValue;
    onEditValue: (annotationValue: IVideoAnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
  } = $props();

  // Variables
  let tools = $derived(
    new Map<string, IConfigValue[]>(
      Object.entries(getDriver().config)
        .filter(([shapeType, _]) => shapeType != "entry:root")
        .map(([shapeType, { values }]) => [shapeType, values]),
    ),
  );
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined,
  );
  let defaultMode = $derived(mode == "default" || !tools.has(mode));

  // Derived disabled state using the annotation module
  let disabled = $derived(
    (selAnnotation && annotation.isLocked(selAnnotation.id)) ||
    (defaultMode || mode == "entry:root" ? !!entryRoot?.value?.locked : false) ||
    !["annotate", "review"].includes(getDriver().workflowStep)
  );

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup class="p-3">
      <SidebarGroupContent>
        {#key [annotationValue, mode, entryRoot?.value?.category]}
          <SelectionPanel
            selectedCategory={(defaultMode
              ? annotationValue.category || entryRoot?.value?.category
              : annotationValue.category) || ""}
            {annotationId}
            annotationValue={(defaultMode
              ? Object.keys(annotationValue).length
                ? annotationValue
                : entryRoot?.value
              : annotationValue) || {}}
            onSelectCategory={(selectedCategoryId) =>
              categorySelection(defaultMode ? "entry:root" : mode, selectedCategoryId)}
            onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
            onEditValue={(value) => value && onEditValue(value, defaultMode ? "entry:root" : mode)}
            {disabled}
          />
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>