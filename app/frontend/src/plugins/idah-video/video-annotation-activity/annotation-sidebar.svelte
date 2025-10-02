<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type {
    CategoryConfiguration,
    LabellingConfiguration,
    PropertyConfiguration,
    VideoAnnotation,
    VideoMode,
  } from "./VideoAnnotationContext";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import SidebarGroupLabel from "@/components/ui/sidebar/sidebar-group-label.svelte";
  import CategoriesSelection from "./categories-selection.svelte";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationsIndexedDB } from "./indexedDB";
  import type { CategoryDefinition } from "@/context/ActivityContext";

  let {
    annotationValue,
    onEditValue,
    onSelectAnnotation,
    onDeleteAnnotation,
    context,
    mode,
    currentFrame,
    db,
  }: {
    currentFrame: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation) => void;
    context: IActivityContext;
    mode: string;
    db?: AnnotationsIndexedDB;
  } = $props();

  let tools = (context.config as LabellingConfiguration).categories.reduce((acc, v: CategoryConfiguration) => {
    if (!acc.has(v.type)) acc.set(v.type, [v]);
    else {
      let categories = acc.get(v.type);

      if (categories) categories.push(v);
      else categories = [v];

      acc.set(v.type, categories);
    }
    return acc;
  }, new Map<string, CategoryConfiguration[]>());

  let searchValue = $state("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let filteredTools = $derived.by(async () => {
    if (!searchValue) return tools;

    return new Promise<Map<string, CategoryConfiguration[]>>((resolve) => {
      const filtered = new Map<string, CategoryConfiguration[]>();
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
          label: category.name,
          attributes: category,
        },
        mode,
      );
    } else {
      onEditValue(
        Object.fromEntries(Object.entries(annotationValue).filter(([type, _]) => type == "categories")),
        mode,
      );
    }
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

<Sidebar variant="inset" collapsible="none" class="w-sm">
  <SidebarHeader>
    {#if !tools.has(mode)}
      <Input placeholder="Search observable" oninput={(e) => searchCategory(e)} />
    {/if}
  </SidebarHeader>
  <SidebarContent>
    {#await filteredTools}
      <p class="p-4 text-sm text-gray-500">Searching...</p>
    {:then searchedTools}
      {#if searchedTools.size === 0}
        <p class="p-4 text-sm text-gray-500">No results found</p>
      {:else}
        {#each searchedTools as [tool, categories]}
          {#if !tools.has(mode) || tool == mode}
            <SidebarGroup>
              <SidebarGroupContent>
                <CategoriesSelection
                  {db}
                  type={tool}
                  {currentFrame}
                  {categories}
                  selected={annotationValue.category}
                  {onSelectAnnotation}
                  {onDeleteAnnotation}
                  onSelect={(s) => categorySelection(tool, s)}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          {/if}
        {/each}
      {/if}
    {/await}
  </SidebarContent>
</Sidebar>
