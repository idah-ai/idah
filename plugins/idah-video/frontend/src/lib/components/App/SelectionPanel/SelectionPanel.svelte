<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Icon from "$lib/components/ui/Icon";

  import { CrosshairIcon, Trash2Icon } from "@lucide/svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";

  import BooleanProperty from "$lib/components/App/SelectionPanel/Properties/_BooleanProperty.svelte";
  import IntegerProperty from "$lib/components/App/SelectionPanel/Properties/_IntegerProperty.svelte";
  import MultipleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_MultipleSelectProperty.svelte";
  import SingleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_SingleSelectProperty.svelte";
  import TextProperty from "$lib/components/App/SelectionPanel/Properties/_TextProperty.svelte";

  import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { data } from "$lib/state/data.svelte";
  import { compareGroups, categoryValueToLabel } from "$lib/utils/annotation";
  import type { IVideoAnnotationRecord } from "$lib/types";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { IVideoAnnotationValue } from "$lib/types";

  type Props = {
    selectedCategory: string;
    annotationId?: string;
    annotationValue: IVideoAnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    onEditValue: (value?: IVideoAnnotationValue) => void;
    disabled: boolean;
  };

  let {
    selectedCategory,
    annotationId,
    annotationValue,
    onSelectCategory,
    onReSelectCategory,
    onEditValue,
    disabled,
  }: Props = $props();

  // -----------------------------------------------------------------------
  // Determine which shape type config to use based on selection state
  // -----------------------------------------------------------------------
  let sel = $derived(selection.value);

  // The active shape type: from annotation, from group (via first annotation), or from drawing mode
  let shapeType = $derived.by<string | undefined>(() => {
    if (sel?.type === "annotation") return sel.annotation.shape.type as string;
    if (sel?.type === "group" && data.annotations) {
      // Find the first annotation belonging to this group to get its shape type
      const items = data.annotations.items as unknown as IVideoAnnotationRecord[];
      const groupAnn = items.find((a) => (a.metadata?.group_id ?? a.id) === sel.groupId);
      if (groupAnn) return groupAnn.shape.type as string;
    }
    return viewport.mode;
  });

  let config = $derived(shapeType ? getDriver().getFilteredConfig(shapeType, annotationValue as unknown as Record<string, unknown>) : undefined);
  let configValues = $derived(config?.values ?? []);

  // Annotation from the selected group (for group edit mode display)
  // NOTE: Must be declared BEFORE effectiveSelectedCategory since it depends on it
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
    sel?.type === "group"
      ? (groupAnnotation?.value?.category || "")
      : selectedCategory
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

  // Group display info
  let groupIdForDisplay = $derived.by<string | undefined>(() => {
    if (sel?.type === "group") {
      const parts = sel.groupId.split("-");
      return parts[parts.length - 1];
    }
    return undefined;
  });

  // -----------------------------------------------------------------------
  // Annotations on current frame (for default mode, no selection)
  // Sorted in the same group-by-group order as the timeline
  // -----------------------------------------------------------------------
  let currentFrame = $derived(viewport.video.currentFrame.value);
  let currentFrameAnnotations = $derived.by<IVideoAnnotationRecord[]>(() => {
    if (!data.annotations) return [];
    const items = data.annotations.items as unknown as IVideoAnnotationRecord[];
    const frame = currentFrame;

    // Filter to current frame
    const onFrame = items.filter(
      (ann) => ann.shape.start <= frame && ann.shape.end >= frame
    );

    // Group by groupId for sorting (same as timeline's groupAnnotations + compareGroups)
    const map = new Map<string, IVideoAnnotationRecord[]>();
    for (const ann of onFrame) {
      const gid = ann.metadata?.group_id ?? ann.id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(ann);
    }

    // Build groups with `annotations` key to match compareGroups signature, then flatten
    const sorted: IVideoAnnotationRecord[] = [];
    const groups = Array.from(map.entries()).map(([groupId, anns]) => ({
      groupId,
      annotations: anns.sort((a, b) => a.shape.start - b.shape.start || a.shape.end - b.shape.end),
    }));
    groups.sort(compareGroups);

    // Flatten preserving group order
    for (const group of groups) {
      for (const ann of group.annotations) {
        sorted.push(ann);
      }
    }

    return sorted;
  });

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

  function reselectCategory(reselectedCategoryId: string) {
    onReSelectCategory?.(reselectedCategoryId);
  }

  function getAnnotationActions(ann: IVideoAnnotationRecord) {
    return [
      {
        label: "Focus Annotation",
        icon: CrosshairIcon,
        onclick: (e: MouseEvent) => {
          e.stopPropagation();
          selection.selectAnnotation(ann);
          getDriver().command.call("timeline.focus");
        }
      },
      {
        label: "Delete Annotation",
        icon: Trash2Icon,
        onclick: (e: MouseEvent) => {
          e.stopPropagation();
          getDriver().command.call("annotation.delete", { annotationId: ann.id });
        }
      }
    ];
  }
</script>

{#snippet shapeIcon(color: string | null | undefined)}
  {#if shapeType === VIDEO_POLYGON}
    <Icon src={polygonIconSvg} {color} />
  {:else}
    <Icon src={vectorSquareIconSvg} {color} />
  {/if}
{/snippet}

{#snippet renderProperties(p: IConfigProperty, i: number)}
  <div class="flex flex-col gap-1">
    {#if p.type === "text"}
      <TextProperty
        property={p}
        value={annotationValue.attributes?.[p.id] as any}
        onValueChange={(v: any) => onValueChange(p, v)}
        {disabled}
      />
    {:else if p.type === "integer"}
      <IntegerProperty
        property={p}
        value={annotationValue.attributes?.[p.id] as any}
        onValueChange={(v: any) => onValueChange(p, v)}
        {disabled}
      />
    {:else if p.type === "boolean"}
      <BooleanProperty
        property={p}
        value={annotationValue.attributes?.[p.id] as any}
        onValueChange={(v: any) => onValueChange(p, v)}
        {disabled}
      />
    {:else if p.type === "single-select"}
      <SingleSelectProperty
        property={p}
        value={annotationValue.attributes?.[p.id] as any}
        onValueChange={(v: any) => onValueChange(p, v)}
        {disabled}
      />
    {:else if p.type === "multi-select"}
      <MultipleSelectProperty
        property={p}
        value={annotationValue.attributes?.[p.id] as any}
        onValueChange={(v: any) => onValueChange(p, v)}
        {disabled}
      />
    {/if}
  </div>
{/snippet}

<!-- ============ ANNOTATIONS ON CURRENT FRAME (default mode, no selection) ============ -->
{#if !sel}
  {#if viewport.mode === "default" && currentFrameAnnotations.length > 0}
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Text weight="semibold">Annotations</Text>
        <Badge variant="secondary">{currentFrameAnnotations.length}</Badge>
        <Text size="sm" class="text-muted-foreground ml-auto">on Frame : {currentFrame + 1}</Text>
      </div>
      <div class="flex flex-col gap-1">
      <Separator class="my-2" />
{#each currentFrameAnnotations as ann (ann.id)}
  {@const annShapeType = ann.shape.type as string}
  {@const annConfig = getDriver().config[annShapeType]}
  {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
  {@const annColor = annCategory?.color ?? null}
  {@const annGroupId = ann.metadata?.group_id ?? ann.id}
  {@const annGroupIdLastPart = annGroupId.split("-").pop()}
  {@const annDisplayName = annCategory ? `${annCategory.label}-${annGroupIdLastPart}` : (ann.value?.category ?? "Uncategorized")}
  {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
  <div class="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent">
    <button
      class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
      onclick={() => selection.selectAnnotation(ann)}
    >
      {#if annShapeType === VIDEO_POLYGON}
        <Icon src={polygonIconSvg} color={annColor} />
      {:else}
        <Icon src={vectorSquareIconSvg} color={annColor} />
      {/if}
      <div class="flex flex-col min-w-0">
        {#if annParentLabel.length > 0}
          <span class="text-xs text-muted-foreground truncate">{annParentLabel}</span>
        {/if}
        <span class="truncate">{annDisplayName}</span>
      </div>
    </button>

    <div class="ml-auto flex shrink-0 items-center gap-0">
      {#each getAnnotationActions(ann) as { label, icon: Icon, onclick }}
        <CategoryAction
          {label}
          icon={Icon}
          {onclick}
          class = "opacity-0 group-hover:opacity-100 transition-opacity"
        />
      {/each}
    </div>
  </div>
{/each}
      </div>
    </section>
  {/if}

  {#if config}
    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Text weight="semibold">{modeTitle}</Text>
        <Badge variant="success-200">CREATE</Badge>
      </div>

      <div class="flex flex-col gap-1">
        <Text size="sm" weight="semibold">Category</Text>
        <Select type="single" onValueChange={onSelectCategory} {disabled}>
          <SelectTrigger class="data-placeholder:text-secondary-foreground bg-secondary h-auto! w-full truncate py-2 text-xs">
            {#if category?.label}
              {@const parentLabel = categoryValueToLabel(category.id)}
              <div class="flex flex-col gap-1 text-left">
                {#if parentLabel.length > 0}
                  <div class="whitespace-break-spaces">{parentLabel}</div>
                {/if}
                <div class="flex items-center justify-start gap-1">
                  {@render shapeIcon(category.color)}
                  <b>{category.label}</b>
                </div>
              </div>
            {/if}
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {#each configValues as { id: value, label, color }, index (`${value}-${index}`)}
                {@const valueLabel = categoryValueToLabel(value, label)}
                <SelectItem
                  label={valueLabel}
                  {value}
                  class={"text-xs " + (category?.id == value ? "bg-primary/20 opacity-100!" : "")}
                  disabled={category?.id == value}
                >
                  {@render shapeIcon(color)}
                  {valueLabel}
                </SelectItem>
              {/each}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <!-- PROPERTIES -->
      {#if properties.length > 0}
        <section class="flex flex-col gap-2">
          <div class="flex flex-row items-center gap-2">
            <Text size="sm" weight="semibold">Properties</Text>
          </div>
          {#each properties as property, i (`${property.id}-${i}`)}
            {@render renderProperties(property, i)}
          {/each}
        </section>
      {/if}
    </section>
  {/if}

<!-- ============ GROUP SELECTION ============ -->
{:else if sel.type === "group"}
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Text weight="semibold">{modeTitle}</Text>
        <Badge variant="info">EDIT</Badge>
      </div>
      <Text size="sm" class="text-muted-foreground">
        {groupAnnDisplayName}
      </Text>
    </div>

    <div class="flex flex-col gap-1">
      <Text size="sm" weight="semibold">Category</Text>
      <Select type="single" onValueChange={reselectCategory} {disabled}>
        <SelectTrigger class="data-placeholder:text-secondary-foreground bg-secondary h-auto! w-full truncate py-2 text-xs">
          {#if category?.label}
            {@const parentLabel = categoryValueToLabel(category.id)}
            <div class="flex flex-col gap-1 text-left">
              {#if parentLabel.length > 0}
                <div class="whitespace-break-spaces">{parentLabel}</div>
              {/if}
              <div class="flex items-center justify-start gap-1">
                {@render shapeIcon(category.color)}
                <b>{category.label}</b>
              </div>
            </div>
          {:else}
            Select category
          {/if}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {#each configValues as { id: value, label, color }, index (`${value}-${index}`)}
              {@const valueLabel = categoryValueToLabel(value, label)}
              <SelectItem
                class={"text-xs " + (effectiveSelectedCategory == value ? "bg-primary/20 opacity-100!" : "")}
                label={valueLabel}
                {value}
                disabled={effectiveSelectedCategory == value}
              >
                {@render shapeIcon(color)}
                {valueLabel}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </section>

<!-- ============ ANNOTATION SELECTION ============ -->
{:else if sel.type === "annotation"}
  {@const selAnnGroupId = sel.annotation.metadata?.group_id ?? sel.annotation.id}
  {@const selAnnGroupIdLastPart = selAnnGroupId.split("-").pop()}
  {@const selAnnDisplayName = category ? `${category.label}-${selAnnGroupIdLastPart}` : undefined}
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Text weight="semibold">{modeTitle}</Text>
        <Badge variant="info">EDIT</Badge>
      </div>
      {#if selAnnDisplayName}
        <Text size="sm" class="text-muted-foreground">
          {selAnnDisplayName}
        </Text>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <Text size="sm" weight="semibold">Category</Text>
      <Select type="single" onValueChange={reselectCategory} {disabled}>
        <SelectTrigger class="data-placeholder:text-secondary-foreground bg-secondary h-auto! w-full truncate py-2 text-xs">
          {#if category?.label}
            {@const parentLabel = categoryValueToLabel(category.id)}
            <div class="flex flex-col gap-1 text-left">
              {#if parentLabel.length > 0}
                <div class="whitespace-break-spaces">{parentLabel}</div>
              {/if}
              <div class="flex items-center justify-start gap-1">
                {@render shapeIcon(category.color)}
                <b>{category.label}</b>
              </div>
            </div>
          {:else}
            Select category
          {/if}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {#each configValues as { id: value, label, color }, index (`${value}-${index}`)}
              {@const valueLabel = categoryValueToLabel(value, label)}
              <SelectItem
                class={"text-xs " + (selectedCategory == value ? "bg-primary/20 opacity-100!" : "")}
                label={valueLabel}
                {value}
                disabled={selectedCategory == value}
              >
                {@render shapeIcon(color)}
                {valueLabel}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <!-- PROPERTIES -->
    {#if properties.length > 0}
      <Separator class="mt-3" />
      <section class="flex flex-col gap-2">
        <div class="flex flex-row items-center gap-2">
          <Text size="sm" weight="semibold">Properties</Text>
        </div>
        {#each properties as property, i (`${property.id}-${i}`)}
          {@render renderProperties(property, i)}
        {/each}
      </section>
    {/if}
  </section>
{/if}
