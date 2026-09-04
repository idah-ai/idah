<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";

  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { cn } from "$lib/utils";
  import { VIDEO_BOUNDING_BOX } from "$lib/types";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { IConfigProperty, IConfigValue } from "$idah/v2/types";
  import type { IVideoAnnotationRecord, IVideoAnnotationValue } from "$lib/types";

  type Props = {
    modeTitle: string;
    shapeType: string | undefined;
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    properties: IConfigProperty[];
    annotationValue: IVideoAnnotationValue;
    displayName: string | undefined;
    onReSelectCategory: (reselectedCategoryId?: string) => void;
    onValueChange: (property: IConfigProperty, value: string | number | string[] | boolean | undefined) => void;
    disabled: boolean;
  };

  let {
    modeTitle,
    shapeType,
    configValues,
    category,
    selectedCategory,
    properties,
    annotationValue,
    displayName,
    onReSelectCategory,
    onValueChange,
    disabled,
  }: Props = $props();

  let sel = $derived(selection.value);
  let annotation = $derived(
    sel?.type === "annotation" ? (sel.annotation as unknown as IVideoAnnotationRecord) : undefined,
  );
</script>

<section class="relative flex flex-col gap-3">
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <Text weight="semibold">{modeTitle}</Text>
      <Badge variant="info">EDIT</Badge>
    </div>
    {#if displayName}
      <Text size="sm" class="text-muted-foreground">
        {displayName}
      </Text>
    {/if}
  </div>

  {#if annotation}
    <div class="absolute top-0 right-0 flex items-center gap-0">
      {#each getAnnotationActions(annotation) as { label, icon: Icon, disabled: actionDisabled, onclick }, index (index)}
        <CategoryAction
          {label}
          icon={Icon}
          disabled={actionDisabled}
          {onclick}
          class={cn({ "cursor-not-allowed opacity-30": actionDisabled })}
        />
      {/each}
    </div>
  {/if}

  <CategorySelect
    {configValues}
    {category}
    {selectedCategory}
    {shapeType}
    onValueChange={onReSelectCategory}
    {disabled}
    placeholder="Select category"
  />

  {#if properties.length > 0}
    <Separator class="mt-3" />
    <PropertiesSection {properties} {annotationValue} {onValueChange} {disabled} />
  {/if}

  {#if annotation?.shape?.type === VIDEO_BOUNDING_BOX}
    {@const shape = annotation.shape}
    {@const interpolated = getInterpolatedFrame(shape, viewport.video.displayedFrame.value)}
    {@const points = interpolated?.points as [number, number][] | undefined ?? []}
    {#if points.length >= 4}
      {@const xs = points.map((p) => p[0])}
      {@const ys = points.map((p) => p[1])}
      {@const pxW = ((Math.max(...xs) - Math.min(...xs)) * media.width).toFixed(0)}
      {@const pxH = ((Math.max(...ys) - Math.min(...ys)) * media.height).toFixed(0)}
      <Separator class="mt-3" />
      <section class="flex flex-col gap-2">
        <div class="flex flex-row items-center gap-2">
          <Text size="sm" weight="semibold">Dimensions</Text>
        </div>
        <Text size="sm" class="text-muted-foreground">
          Width: {pxW} px, Height: {pxH} px
        </Text>
      </section>
    {/if}
  {/if}
</section>
