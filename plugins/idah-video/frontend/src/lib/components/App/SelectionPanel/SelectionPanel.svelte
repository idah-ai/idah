<script lang="ts">
  import AnnotationsList from "$lib/components/App/SelectionPanel/_AnnotationsList.svelte";
  import CreateMode from "$lib/components/App/SelectionPanel/_CreateMode.svelte";
  import EditMode from "$lib/components/App/SelectionPanel/_EditMode.svelte";
  import GroupEditMode from "$lib/components/App/SelectionPanel/_GroupEditMode.svelte";

  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { compareGroups } from "$lib/utils/annotation";
  import { NON_DRAWABLE_SHAPE_TYPES } from "$lib/types";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { IVideoAnnotationRecord, IVideoAnnotationValue } from "$lib/types";

  type Props = {
    selectedCategory: string;
    annotationId?: string;
    annotationValue: IVideoAnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    onEditValue: (value?: IVideoAnnotationValue) => void;
    disabled: boolean;
    /** Override the shape type (defaults to viewport.mode when no selection). */
    shapeTypeOverride?: string;
  };

  let {
    selectedCategory,
    annotationValue,
    onSelectCategory,
    onReSelectCategory,
    onEditValue,
    disabled,
    shapeTypeOverride,
  }: Props = $props();

  let effectiveDisabled = $derived(disabled || !isEditable());

  // -----------------------------------------------------------------------
  // Determine which shape type config to use based on selection state
  // -----------------------------------------------------------------------
  let sel = $derived(selection.value);

  // A selected tagging annotation (entry:root / idah-video:frame) is never shown
  // in the Annotations tab — it's edited through the Tagging tab instead. Treat it
  // as no selection here so the annotations list renders rather than the tagging form.
  let isTaggingAnnotation = $derived(
    sel?.type === "annotation" && NON_DRAWABLE_SHAPE_TYPES.has((sel.annotation.shape as { type?: string })?.type ?? ""),
  );

  // The active shape type: from annotation, from group (via first annotation), from
  // the shapeTypeOverride prop, or from drawing mode.
  let shapeType = $derived.by<string | undefined>(() => {
    if (sel?.type === "annotation") return sel.annotation.shape.type as string;
    if (sel?.type === "group" && data.annotations) {
      const items = data.annotations.items as unknown as IVideoAnnotationRecord[];
      const groupAnn = items.find((a) => (a.metadata?.group_id ?? a.id) === sel.groupId);
      if (groupAnn) return groupAnn.shape.type as string;
    }
    return shapeTypeOverride ?? viewport.mode;
  });

  let config = $derived(
    shapeType
      ? getDriver().getFilteredConfig(shapeType, annotationValue as unknown as Record<string, unknown>)
      : undefined,
  );
  let configValues = $derived(config?.values ?? []);

  // Annotation from the selected group (for group edit mode display)
  let groupAnnotation = $derived.by<IVideoAnnotationRecord | undefined>(() => {
    if (sel?.type !== "group" || !data.annotations) return undefined;
    const items = data.annotations.items as unknown as IVideoAnnotationRecord[];
    return items.find((a) => (a.metadata?.group_id ?? a.id) === sel.groupId);
  });

  let groupAnnDisplayName = $derived.by<string>(() => {
    if (!groupAnnotation || !sel || sel.type !== "group") return "";
    const gAnn = groupAnnotation;
    const gShapeType = gAnn.shape.type as string;
    const gConfig = getDriver().config[gShapeType];
    const gCategory = gConfig?.values?.find((v) => v.id === gAnn.value?.category);
    const lastPart = sel.groupId.split("-").pop() ?? "";
    return gCategory ? `${gCategory.label}-${lastPart}` : (gAnn.value?.category ?? "Uncategorized");
  });

  // When a group is selected, always use the annotation's current category from the data store,
  // so it stays in sync even when the parent doesn't update the selectedCategory prop.
  let effectiveSelectedCategory = $derived(
    sel?.type === "group" ? groupAnnotation?.value?.category || "" : selectedCategory,
  );

  let category = $derived(configValues.find((c) => c.id == effectiveSelectedCategory));
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

  // Display name for the selected single annotation (edit mode)
  let annotationDisplayName = $derived.by<string | undefined>(() => {
    if (sel?.type !== "annotation") return undefined;
    const groupId = sel.annotation.metadata?.group_id ?? sel.annotation.id;
    const lastPart = groupId.split("-").pop();
    return category ? `${category.label}-${lastPart}` : undefined;
  });

  // -----------------------------------------------------------------------
  // Annotations on current frame (default mode, no selection),
  // sorted in the same group-by-group order as the timeline
  // -----------------------------------------------------------------------
  let currentFrame = $derived(viewport.video.currentFrame.value);
  let currentFrameAnnotations = $derived.by<IVideoAnnotationRecord[]>(() => {
    if (!data.annotations) return [];
    const items = data.annotations.items as unknown as IVideoAnnotationRecord[];
    const frame = currentFrame;

    // Filter to current frame. Non-drawable records (entry:root spanning the
    // whole video, and per-frame idah-video:frame) are excluded — they are not
    // drawable shapes and are only ever created/edited through the Tagging tab.
    const onFrame = items.filter(
      (ann) =>
        ann.shape.start <= frame &&
        ann.shape.end >= frame &&
        !NON_DRAWABLE_SHAPE_TYPES.has((ann.shape as any)?.type),
    );

    // Group by groupId for sorting (same as timeline's groupAnnotations + compareGroups)
    const map = new Map<string, IVideoAnnotationRecord[]>();
    for (const ann of onFrame) {
      const gid = ann.metadata?.group_id ?? ann.id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(ann);
    }

    const groups = Array.from(map.entries()).map(([groupId, anns]) => ({
      groupId,
      annotations: anns.sort((a, b) => a.shape.start - b.shape.start || a.shape.end - b.shape.end),
    }));
    groups.sort(compareGroups);

    // Flatten preserving group order
    const sorted: IVideoAnnotationRecord[] = [];
    for (const group of groups) {
      for (const ann of group.annotations) {
        sorted.push(ann);
      }
    }
    return sorted;
  });

  let showAnnotationsList = $derived(
    !shapeTypeOverride &&
      (viewport.mode === "editor" || viewport.isReviewWorkspace) &&
      currentFrameAnnotations.length > 0,
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

{#if !sel || isTaggingAnnotation}
  <!-- Default mode: list of annotations on the current frame -->
  {#if showAnnotationsList}
    <AnnotationsList annotations={currentFrameAnnotations} {currentFrame} />
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
      disabled={effectiveDisabled}
    />
  {/if}
{:else if sel.type === "group"}
  <!-- Group edit mode -->
  <GroupEditMode
    {modeTitle}
    {shapeType}
    {configValues}
    {category}
    selectedCategory={effectiveSelectedCategory}
    displayName={groupAnnDisplayName}
    onReSelectCategory={reselectCategory}
    disabled={effectiveDisabled}
  />
{:else if sel.type === "annotation"}
  <!-- Edit mode: edit the currently selected annotation -->
  <EditMode
    {modeTitle}
    {shapeType}
    {configValues}
    {category}
    {selectedCategory}
    {properties}
    {annotationValue}
    displayName={annotationDisplayName}
    onReSelectCategory={reselectCategory}
    {onValueChange}
    disabled={effectiveDisabled}
  />
{/if}
