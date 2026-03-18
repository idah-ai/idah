<script lang="ts">
  import { CircleXIcon } from "@lucide/svelte";

  import InputField from "$lib/components/app/forms/fields/input/input-field.svelte";
  import SidebarContent from "$lib/components/ui/sidebar/sidebar-content.svelte";
  import SidebarHeader from "$lib/components/ui/sidebar/sidebar-header.svelte";
  import Sidebar from "$lib/components/ui/sidebar/sidebar.svelte";

  import { cn } from "$lib/utils";

  import CategorySidebar from "$lib/plugin/layout/sidebar/category-sidebar.svelte";

  import { ENTRY_ROOT } from "$lib/plugin/type";
  import { entryRoot } from "$lib/plugin/video-annotation-activity/idb_store.svelte";

  import type { IActivityContext, IConfigValue } from "$idah/context/activity-context";
  import type {
    AnnotationGroup,
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "$idah/context/annotation-context";

  import type { AnnotationsIndexedDB } from "$lib/plugin/video-annotation-activity/indexedDB";

  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

  // Props
  let {
    view,
    sidebarWidthRem,
    annotationValue,
    onEditValue,
    onSelectAnnotation,
    onSelectAnnotationGroup,
    onDeleteAnnotation,
    onVisibility,
    onLock,
    context,
    mode,
    currentFrame,
    db,
    class: className,
  }: {
    view: "sidebar" | "popover";
    sidebarWidthRem: number;
    currentFrame: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation?: TAnnotationObj) => void;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<TAnnotationObj>) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj) => void;
    onLock: (locked: boolean, annotation?: TAnnotationObj) => void;
    onVisibility: (hidden: boolean, annotation?: TAnnotationObj) => void;
    context: IActivityContext;
    mode: string;
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

  function clearSearch() {
    searchValue = "";
  }
</script>

<Sidebar variant="inset" collapsible="none" class={cn(className)} style="width: ${sidebarWidthRem}rem">
  {#if !tools.has(mode)}
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
      {#if !filteredTools.has(mode) || (filteredTools.has(mode) && tool == mode) || mode == ENTRY_ROOT}
        <CategorySidebar
          {view}
          {db}
          {currentFrame}
          currentMode={mode}
          modalityShape={tool}
          {categories}
          selectedCategory={tool == ENTRY_ROOT && !(tool == mode)
            ? $entryRoot?.value.category
            : annotationValue.category}
          onSelectCategory={(selected) => categorySelection(tool, selected)}
          {onSelectAnnotationGroup}
          {onDeleteAnnotation}
          {onLock}
          {onVisibility}
        ></CategorySidebar>
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
