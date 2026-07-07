<script lang="ts">
  import AnnotationsList from "$lib/components/App/SelectionPanel/_AnnotationsList.svelte";
  import CreateMode from "$lib/components/App/SelectionPanel/_CreateMode.svelte";
  import EditMode from "$lib/components/App/SelectionPanel/_EditMode.svelte";

  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { DEFAULT_MODE } from "$lib/types";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { IImageAnnotationRecord, IImageAnnotationValue } from "$lib/types";

  type Props = {
    selectedCategory: string;
    annotationId?: string;
    annotationValue: IImageAnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    onEditValue: (value?: IImageAnnotationValue) => void;
    disabled: boolean;
  };

  let { selectedCategory, annotationValue, onSelectCategory, onReSelectCategory, onEditValue, disabled }: Props =
    $props();

  // -----------------------------------------------------------------------
  // Determine which shape type config to use based on selection state
  // -----------------------------------------------------------------------
  let sel = $derived(selection.value);

  // The active shape type: from annotation or from drawing mode
  let shapeType = $derived.by<string | undefined>(() => {
    if (sel) return sel.shape.type as string;
    return viewport.mode;
  });

  let config = $derived(
    shapeType
      ? getDriver().getFilteredConfig(shapeType, annotationValue as unknown as Record<string, unknown>)
      : undefined,
  );
  let configValues = $derived(config?.values ?? []);
  let category = $derived(configValues.find((c) => c.id == selectedCategory));
  let properties = $derived(config?.properties ?? []);

  // Human-readable mode title from shape type
  let modeTitle = $derived.by(() => {
    if (!shapeType) return "";
    return shapeType
      .split(":")
      .reverse()[0]
      .split(/-|_/)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  // All annotations on the current frame (default mode, no selection)
  let currentFrameAnnotations = $derived.by<IImageAnnotationRecord[]>(() => {
    if (!data.annotations) return [];
    return data.annotations.items as unknown as IImageAnnotationRecord[];
  });

  let showAnnotationsList = $derived(
    (viewport.mode === DEFAULT_MODE || viewport.mode === "review") && currentFrameAnnotations.length > 0,
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  function onValueChange(property: IConfigProperty, v: string | number | string[] | undefined | boolean) {
    const newValue = {
      ...annotationValue,
      attributes: {
        ...(annotationValue.attributes || {}),
        [property.id]: v,
      },
    };
    onEditValue(newValue);
  }

  function reselectCategory(reselectedCategoryId?: string) {
    if (reselectedCategoryId != undefined) onReSelectCategory?.(reselectedCategoryId);
  }
</script>

{#if !sel}
  <!-- Default mode: list of annotations on the current frame -->
  {#if showAnnotationsList}
    <AnnotationsList annotations={currentFrameAnnotations} />
  {/if}

  <!-- Create mode: pick a category and fill properties for the shape being drawn -->
  {#if config}
    <CreateMode
      {modeTitle}
      {shapeType}
      {configValues}
      {category}
      {selectedCategory}
      {properties}
      {annotationValue}
      {onSelectCategory}
      {onValueChange}
      {disabled}
    />
  {/if}
{:else}
  <!-- Edit mode: edit the currently selected annotation -->
  <EditMode
    {modeTitle}
    {shapeType}
    {configValues}
    {category}
    {selectedCategory}
    {properties}
    {annotationValue}
    onReSelectCategory={reselectCategory}
    {onValueChange}
    {disabled}
  />
{/if}
