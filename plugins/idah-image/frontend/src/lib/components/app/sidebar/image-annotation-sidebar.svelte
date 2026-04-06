<script lang="ts">
  // import InputField from "$lib/components/app/forms/fields/input/input-field.svelte";
  import SidebarContent from "$lib/components/ui/sidebar/sidebar-content.svelte";
  import SidebarHeader from "$lib/components/ui/sidebar/sidebar-header.svelte";
  import Sidebar from "$lib/components/ui/sidebar/sidebar.svelte";

  import { cn } from "$lib/utils";

  import ImageCategorySidebar from "$lib/components/app/sidebar/image-category-sidebar.svelte";

  import { entryRoot } from "$lib/plugin/store/idb-store.svelte";
  import { currentMode } from "$lib/plugin/store/store";
  import { ENTRY_ROOT } from "$lib/plugin/types";

  import Input from "$lib/components/ui/input/input.svelte";

  import type { AnnotationGroup, AnnotationValue } from "$lib/context/annotation-context";
  import type { IActivityContext, IConfigValue } from "$lib/context/context";
  import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";
  import type { AnnotationsIndexedDB } from "$lib/plugin/indexedDB";

  // Props
  let {
    view,
    sidebarWidthRem,
    annotationValue,
    // onEditValue,
    onSelectAnnotation,
    onSelectAnnotationGroup,
    onDeleteAnnotation,
    onVisibility,
    onEditability,
    context,
    db,
    class: className,
  }: {
    view: "sidebar" | "popover";
    sidebarWidthRem: number;
    annotationValue: AnnotationValue;
    // onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation?: ImageAnnotationObject) => void;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<ImageAnnotationObject>) => void;
    onDeleteAnnotation: (annotation: ImageAnnotationObject) => void;
    onEditability: (locked: boolean, annotation?: ImageAnnotationObject) => void;
    onVisibility: (hidden: boolean, annotation?: ImageAnnotationObject) => void;
    context: IActivityContext;
    db?: AnnotationsIndexedDB;
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
      // onEditValue({ category }, shape_type);
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

<Sidebar variant="inset" collapsible="none" class={cn(className)} style="width: ${sidebarWidthRem}rem">
  {#if !tools.has($currentMode)}
    <SidebarHeader>
      <Input placeholder="Search" value={searchValue} oninput={(e) => searchCategory(e)}>
        <!--  {#snippet suffixIcon()}
          {#if searchValue}
            <CircleXIcon class="hover:cursor-pointer" onclick={clearSearch} />
          {/if}
        {/snippet} -->
      </Input>
    </SidebarHeader>
  {/if}

  <SidebarContent>
    {#each filteredTools as [tool, categories] (tool)}
      {#if !filteredTools.has($currentMode) || (filteredTools.has($currentMode) && tool == $currentMode) || $currentMode == ENTRY_ROOT}
        <ImageCategorySidebar
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
          {onEditability}
          {onVisibility}
          {context}
        ></ImageCategorySidebar>
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
