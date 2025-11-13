<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";

  import Input from "@/components/ui/input/input.svelte";
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import AnnotationTabs from "../../video-annotation-activity/tabs/AnnotationTabs.svelte";
  import CategoriesSelection from "./categories-selection.svelte";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type { IActivityContext, IConfigValue } from "@/plugin/interface/Activity";

  import type { AnnotationsIndexedDB } from "../../video-annotation-activity/indexedDB";

  import { ENTRY_ROOT } from "../../type";
  import { entryRoot } from "../../video-annotation-activity/idb_store.svelte";
  import type { VideoAnnotation } from "../../video-annotation-activity/VideoAnnotationContext";

  // Props
  let {
    sidebarWidthRem = 20,
    annotationValue,
    onEditValue,
    onSelectAnnotation,
    onDeleteAnnotation,
    context,
    mode,
    currentFrame,
    db,
    selected_id,
  }: {
    sidebarWidthRem?: number;
    currentFrame: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation) => void;
    context: IActivityContext;
    mode: string;
    db?: AnnotationsIndexedDB;
    selected_id?: string;
  } = $props();

  let tools = new Map<string, IConfigValue[]>(
    Object.entries(context.config).map(([shapeType, { values }]) => [shapeType, values]),
  );

  let searchValue = $state("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let filteredTools = $derived.by(() => {
    if (!searchValue) return tools;

    const filtered = new SvelteMap<string, IConfigValue[]>();
    for (const [toolType, categories] of tools) {
      const matchingCategories = categories.filter((category) =>
        category.label.toLowerCase().includes(searchValue.toLowerCase()),
      );
      if (matchingCategories.length > 0) {
        filtered.set(toolType, matchingCategories);
      }
    }
    return filtered;
  });

  // Functions
  function categorySelection(shape_type: string, category?: string) {
    if (category) {
      if (shape_type != mode) onSelectAnnotation();
      onEditValue({ category }, shape_type);
    } // else {
    //   onEditValue(
    //     Object.fromEntries(Object.entries(annotationValue).filter(([type, _]) => type == "categories")),
    //     mode,
    //   );
    // }
  }

  function searchCategory(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer for debounced search (300ms delay)
    debounceTimer = setTimeout(() => {
      searchValue = value;
    }, 200);
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;">
  {#if !tools.has(mode)}
    <SidebarHeader>
      <AnnotationTabs></AnnotationTabs>

      <Input placeholder="search" value={searchValue} oninput={(e) => searchCategory(e)} />
    </SidebarHeader>
  {/if}

  <SidebarContent>
    {#each filteredTools as [tool, categories] (tool)}
      {#if !filteredTools.has(mode) || (filteredTools.has(mode) && tool == mode) || mode == ENTRY_ROOT}
        <SidebarGroup>
          <SidebarGroupContent>
            <CategoriesSelection
              {db}
              toolMode={tool == mode}
              type={tool}
              {currentFrame}
              {categories}
              selected_category={tool == ENTRY_ROOT && !(tool == mode)
                ? $entryRoot?.value.category
                : annotationValue.category}
              {selected_id}
              {onSelectAnnotation}
              {onDeleteAnnotation}
              annotationValue={tool == ENTRY_ROOT && !(tool == mode) ? $entryRoot?.value || {} : annotationValue}
              onEditValue={(v) => onEditValue(v, tool)}
              onSelect={(s) => categorySelection(tool, s)}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
