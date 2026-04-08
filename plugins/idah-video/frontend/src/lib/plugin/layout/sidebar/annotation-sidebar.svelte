<script lang="ts">
  import { CircleXIcon } from "@lucide/svelte";

  import InputField from "$lib/components/app/forms/fields/input/input-field.svelte";
  import SidebarContent from "$lib/components/ui/sidebar/sidebar-content.svelte";
  import SidebarHeader from "$lib/components/ui/sidebar/sidebar-header.svelte";
  import Sidebar from "$lib/components/ui/sidebar/sidebar.svelte";

  import { cn } from "$lib/utils";

  import CategorySidebar from "$lib/plugin/layout/sidebar/category-sidebar.svelte";

  import { ENTRY_ROOT } from "$lib/plugin/type";
  import { entryRoot } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import { currentMode } from "$lib/plugin/video-annotation-activity/store/store";

  import type {
    IActivityContext,
    IConfigValue,
  } from "$idah/context/activity-context";
  import type {
    AnnotationGroup,
    AnnotationValue,
  } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
  import type { AnnotationBackend } from "$lib/plugin/video-annotation-activity/data/annotation/annotaiton-backend.svelte";

  // Props
  let {
    view,
    sidebarWidthRem,
    annotationValue,
    onEditValue,
    onSelectAnnotation,
    onSelectAnnotationGroup,
    onDeleteAnnotation,
    context,
    db,
    class: className,
  }: {
    view: "sidebar" | "popover";
    sidebarWidthRem: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation?: VideoAnnotationObject) => void;
    onSelectAnnotationGroup: (
      annotationGroup: AnnotationGroup<VideoAnnotationObject>,
    ) => void;
    onDeleteAnnotation: (annotation: VideoAnnotationObject) => void;
    context: IActivityContext;
    db?: AnnotationBackend;
    class?: string | null;
  } = $props();

  let tools = $derived(
    new Map<string, IConfigValue[]>(
      Object.entries(context.config)
        .filter(([shapeType, _]) => shapeType != ENTRY_ROOT)
        .map(([shapeType, { values }]) => [shapeType, values]),
    ),
  );

  let searchValue = $state("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let filteredTools = $derived.by(() => {
    if (!searchValue) return tools;

    const result = new Map<string, IConfigValue[]>();

    for (const [toolType, categories] of tools) {
      const matching = categories.filter((category) =>
        category.label.toLowerCase().includes(searchValue.toLowerCase()),
      );

      if (matching.length > 0) {
        result.set(toolType, matching);
      }
    }

    return result;
  });

  // Functions
  function categorySelection(shape_type: string, category?: string) {
    if (category) {
      if (shape_type != $currentMode) onSelectAnnotation();
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

  function clearSearch() {
    searchValue = "";
  }
</script>

<Sidebar
  variant="inset"
  collapsible="none"
  class={cn(className)}
  style="width: ${sidebarWidthRem}rem"
>
  {#if !tools.has($currentMode)}
    <SidebarHeader>
      <InputField
        name="input/plugin/search"
        placeholder="Search"
        value={searchValue}
        oninput={(e) => searchCategory(e)}
      >
        {#snippet suffixIcon()}
          {#if searchValue}
            <CircleXIcon class="hover:cursor-pointer" onclick={clearSearch} />
          {/if}
        {/snippet}
      </InputField>
    </SidebarHeader>
  {/if}

  <SidebarContent>
    {#each filteredTools as [tool, categories] (tool)}
      {#if !filteredTools.has($currentMode) || (filteredTools.has($currentMode) && tool == $currentMode) || $currentMode == ENTRY_ROOT}
        <CategorySidebar
          {view}
          {db}
          modalityShape={tool}
          {categories}
          selectedCategory={tool == ENTRY_ROOT && !(tool == $currentMode)
            ? $entryRoot?.value.category
            : annotationValue.category}
          onSelectCategory={(selected) => categorySelection(tool, selected)}
          {onSelectAnnotationGroup}
          {onDeleteAnnotation}
        ></CategorySidebar>
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
