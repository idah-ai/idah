<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Icon from "$lib/components/ui/Icon";

  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";

  import { cn } from "$lib/utils";

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
  import { categoryValueToLabel } from "$lib/utils/annotation";
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
    // For a group we have only the groupId, so fall back to current mode
    // (the group's shape type will be known when the driver enriches selection)
    if (sel?.type === "group") return viewport.mode !== "default" ? viewport.mode : undefined;
    return viewport.mode;
  });

  let config = $derived(shapeType ? getDriver().getFilteredConfig(shapeType, annotationValue as unknown as Record<string, unknown>) : undefined);
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

    // Build sorted groups by earliest start (compareGroups), then flatten with timeline naming
    const sorted: IVideoAnnotationRecord[] = [];
    const groups = Array.from(map.entries()).map(([groupId, anns]) => ({
      groupId,
      anns: anns.sort((a, b) => a.shape.start - b.shape.start || a.shape.end - b.shape.end),
      earliestStart: Math.min(...anns.map((a) => a.shape.start)),
    }));
    groups.sort((a, b) => a.earliestStart - b.earliestStart);

    // Flatten preserving group order
    for (const group of groups) {
      for (const ann of group.anns) {
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
      </div>
      <div class="flex flex-col gap-1">
{#each currentFrameAnnotations as ann (ann.id)}
  {@const annShapeType = ann.shape.type as string}
  {@const annConfig = getDriver().config[annShapeType]}
  {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
  {@const annColor = annCategory?.color ?? null}
  {@const annGroupId = ann.metadata?.group_id ?? ann.id}
  {@const annGroupIdLastPart = annGroupId.split("-").pop()}
  {@const annDisplayName = annCategory ? `${annCategory.label}-${annGroupIdLastPart}` : (ann.value?.category ?? "Uncategorized")}
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
      <span class="truncate">{annDisplayName}</span>
    </button>

    <div class="ml-auto flex shrink-0 items-center gap-0">
      <!-- BUTTON::HIDE/SHOW -->
      <div class={cn("", ann.hidden ? "flex" : "hidden group-hover:flex")}>
        <ToolTooltip label={ann.hidden ? "Show" : "Hide"}>
          {#snippet trigger()}
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                getDriver().command.call("annotation.update", {
                  annotation: ann,
                  value: { hidden: !ann.hidden },
                });
              }}
            >
              {#if ann.hidden}
                <EyeOffIcon />
              {:else}
                <EyeIcon />
              {/if}
            </Button>
          {/snippet}
        </ToolTooltip>
      </div>

      <!-- BUTTON::LOCK/UNLOCK -->
      <div class={cn("", ann.locked ? "flex" : "hidden group-hover:flex")}>
        <ToolTooltip label={ann.locked ? "Unlock" : "Lock"}>
          {#snippet trigger()}
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                getDriver().command.call("annotation.update", {
                  annotation: ann,
                  value: { locked: !ann.locked },
                });
              }}
            >
              {#if ann.locked}
                <LockIcon />
              {:else}
                <LockOpenIcon />
              {/if}
            </Button>
          {/snippet}
        </ToolTooltip>
      </div>

      <!-- BUTTON::DELETE -->
      <div class="hidden group-hover:flex">
        <ToolTooltip label="Delete">
          {#snippet trigger()}
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                getDriver().command.call("annotation.delete", { annotationId: ann.id });
              }}
            >
              <Trash2Icon />
            </Button>
          {/snippet}
        </ToolTooltip>
      </div>
    </div>
  </div>
{/each}
      </div>
    </section>
    <Separator class="my-2" />
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
        Group-{groupIdForDisplay}
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