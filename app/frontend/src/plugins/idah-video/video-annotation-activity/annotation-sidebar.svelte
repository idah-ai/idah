<script lang="ts">
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import Input from "@/components/ui/input/input.svelte";
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import CategoriesSelection from "./categories-selection.svelte";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type { CategoryField } from "$lib/data/model/dataset/labels";
  import type { IActivityContext, ICategoryField } from "@/plugin/interface/Activity";
  import type { AnnotationsIndexedDB } from "./indexedDB";
  import AnnotationTabs from "./tabs/AnnotationTabs.svelte";
  import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
  import { SvelteMap } from "svelte/reactivity";

  let {
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

  let tools = context.config.categories.reduce((acc, v: ICategoryField) => {
    if (!acc.has(v.type)) acc.set(v.type, [v]);
    else {
      let categories = acc.get(v.type);

      if (categories) categories.push(v);
      else categories = [v] as CategoryConfiguration[];

      acc.set(v.type, categories);
    }
    return acc;
  }, new Map<string, CategoryConfiguration[]>());

  let searchValue = $state("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let filteredTools = $derived.by(() => {
    if (!searchValue) return tools;

    const filtered = new SvelteMap<string, CategoryConfiguration[]>();
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
  function categorySelection(mode: string, category?: string) {
    if (category) {
      onEditValue({ category }, mode);
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

<Sidebar variant="inset" collapsible="none" class="w-xs">
  {#if !tools.has(mode)}
    <SidebarHeader>
      <AnnotationTabs></AnnotationTabs>

      <Input placeholder="search" value={searchValue} oninput={(e) => searchCategory(e)} />
    </SidebarHeader>
  {/if}

  <SidebarContent>
    {#each filteredTools as [tool, categories] (tool)}
      <!-- {#if !tools.has(mode) || mode == "visual"} -->
      <SidebarGroup>
        <SidebarGroupContent>
          <CategoriesSelection
            {db}
            toolMode={tool == mode}
            type={tool}
            {currentFrame}
            {categories}
            selected_category={annotationValue.category}
            {selected_id}
            {onSelectAnnotation}
            {onDeleteAnnotation}
            {annotationValue}
            onEditValue={(v) => onEditValue(v, tool)}
            onSelect={(s) => categorySelection(tool, s)}
          />
        </SidebarGroupContent>
      </SidebarGroup>
      <!-- {:else if tool == mode}
        <SidebarGroup>
          <SidebarGroupContent>
            <CategoriesSelection
              {db}
              toolMode={tool == mode}
              type={tool}
              {currentFrame}
              {categories}
              selected_category={annotationValue.category}
              {selected_id}
              {onSelectAnnotation}
              {onDeleteAnnotation}
              onSelect={(s) => categorySelection(tool, s)}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      {/if} -->
    {/each}
  </SidebarContent>
</Sidebar>
