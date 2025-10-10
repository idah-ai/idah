<script lang="ts">
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type { CategoryConfiguration, LabellingConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import CategoriesSelection from "./categories-selection.svelte";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationsIndexedDB } from "./indexedDB";
  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { CategoryField } from "@/data/model/dataset/labels";

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

  let tools = context.config.categories.reduce((acc, v: CategoryField) => {
    if (!acc.has(v.type)) acc.set(v.type, [v]);
    else {
      let categories = acc.get(v.type);

      if (categories) categories.push(v);
      else categories = [v];

      acc.set(v.type, categories);
    }
    return acc;
  }, new Map<string, CategoryField[]>());

  let searchValue = $state("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let filteredTools = $derived.by(async () => {
    if (!searchValue) return tools;

    return new Promise<Map<string, CategoryField[]>>((resolve) => {
      const filtered = new Map<string, CategoryField[]>();
      for (const [toolType, categories] of tools) {
        const matchingCategories = categories.filter((category) =>
          category.label.toLowerCase().includes(searchValue.toLowerCase()),
        );
        if (matchingCategories.length > 0) {
          filtered.set(toolType, matchingCategories);
        }
      }
      resolve(filtered);
    });
  });

  // Functions
  function categorySelection(mode: string, category?: CategoryDefinition) {
    if (category) {
      onEditValue(
        {
          category: category.id,
        },
        mode,
      );

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
  <!-- <SidebarHeader>
    {#if !tools.has(mode)}
      <Input placeholder="search" />
    {/if}
  </SidebarHeader> -->
  <SidebarContent>
    {#each tools as [tool, categories]}
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
