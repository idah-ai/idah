<script lang="ts">
  import { CircleXIcon } from "@lucide/svelte";

  import InputField from "$lib/components/ui/Forms/fields/input/InputField.svelte";
  import SidebarContent from "$lib/components/ui/Sidebar/SidebarContent.svelte";
  import SidebarHeader from "$lib/components/ui/Sidebar/SidebarHeader.svelte";
  import Sidebar from "$lib/components/ui/Sidebar/Sidebar.svelte";

  import { cn } from "$lib/utils";

  import CategoryTree from "$lib/components/App/CategorySelector/_CategoryTree.svelte";

  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { IActivityContext, IConfigValue } from "$idah/context/activity-context";

  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined,
  );
  import type { AnnotationGroup, AnnotationValue } from "$idah/context/annotation-context";
  import type { IVideoAnnotationRecord } from "$idah/v2/video-types";
  import type { DataStore, AnnotationItem } from "$lib/state/data.svelte";

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
    items,
    class: className,
  }: {
    view: "sidebar" | "popover";
    sidebarWidthRem: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation?: IVideoAnnotationRecord) => void;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<IVideoAnnotationRecord>) => void;
    onDeleteAnnotation: (annotation: IVideoAnnotationRecord) => void;
    context: IActivityContext;
    db?: DataStore<AnnotationItem> | null;
    items: IVideoAnnotationRecord[];
    class?: string | null;
  } = $props();

  let tools = $derived(
    new Map<string, IConfigValue[]>(
      Object.entries(context.config)
        .filter(([shapeType, _]) => shapeType != "entry:root")
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
      selection.deselect();
      onSelectAnnotation();
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
  {#if !tools.has(mode) || selAnnotation}
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
      {#if !filteredTools.has(mode) || (filteredTools.has(mode) && tool == mode) || mode == "entry:root"}
        <CategoryTree
          {view}
          {db}
          {items}
          modalityShape={tool}
          {categories}
          selectedCategory={tool == "entry:root" && !(tool == mode)
            ? ($entryRoot as any)?.value?.category
            : annotationValue.category}
          onSelectCategory={(selected) => categorySelection(tool, selected)}
          {onSelectAnnotationGroup}
          {onDeleteAnnotation}
        />
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
