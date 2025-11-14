<script lang="ts">
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type { IActivityContext, IConfigValue } from "@/plugin/interface/Activity";

  import { DEFAULT_MODE, ENTRY_ROOT } from "../../type";
  import CategoryProperties from "../../video-annotation-activity/categoryProperties/categoryProperties.svelte";
  import { entryRoot } from "../../video-annotation-activity/idb_store.svelte";

  // Props
  let {
    sidebarWidthRem = 15,
    annotationValue,
    onEditValue,
    context,
    mode,
  }: {
    sidebarWidthRem?: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    context: IActivityContext;
    mode: string;
  } = $props();

  let tools = new Map<string, IConfigValue[]>(
    Object.entries(context.config)
      .filter(([shapeType, _]) => shapeType != ENTRY_ROOT)
      .map(([shapeType, { values }]) => [shapeType, values]),
  );

  // Functions
  function categorySelection(shape_type: string, category?: string) {
    if (category) onEditValue({ category }, shape_type);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarHeader></SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        {#key [annotationValue, mode, $entryRoot?.value.category]}
          <CategoryProperties
            type={mode == DEFAULT_MODE || !tools.has(mode) ? ENTRY_ROOT : mode}
            selectedCategory={(mode == DEFAULT_MODE || !tools.has(mode)
              ? annotationValue.category || $entryRoot?.value.category
              : annotationValue.category) || ""}
            annotationValue={(mode == DEFAULT_MODE || !tools.has(mode)
              ? Object.keys(annotationValue).length
                ? annotationValue
                : $entryRoot?.value
              : annotationValue) || {}}
            onSelectCategory={(s) => categorySelection(mode == DEFAULT_MODE || !tools.has(mode) ? ENTRY_ROOT : mode, s)}
            onEditValue={(value) =>
              value && onEditValue(value, mode == DEFAULT_MODE || !tools.has(mode) ? ENTRY_ROOT : mode)}
          />
        {/key}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
