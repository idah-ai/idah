<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import BooleanProperty from "$lib/components/App/SelectionPanel/Properties/_BooleanProperty.svelte";
  import IntegerProperty from "$lib/components/App/SelectionPanel/Properties/_IntegerProperty.svelte";
  import MultipleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_MultipleSelectProperty.svelte";
  import SingleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_SingleSelectProperty.svelte";
  import TextProperty from "$lib/components/App/SelectionPanel/Properties/_TextProperty.svelte";

  import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$idah/v2/video-types";
  import { visibilityFullfilled } from "$lib/components/App/SelectionPanel";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { AnnotationValue } from "$idah/context/annotation-context";

  type Props = {
    selectedCategory: string;
    annotationId?: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    onEditValue: (value?: AnnotationValue) => void;
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

  let config = $derived(shapeType ? getDriver().config[shapeType] : undefined);
  let configValues = $derived(config?.values ?? []);
  let configProperties = $derived(config?.properties ?? []);

  let category = $derived(configValues.find((c) => c.id == selectedCategory));
  let properties = $derived(configProperties.filter((p) => visibilityFullfilled(annotationValue, p)));

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
  // Handlers
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
    const new_visible_properties = (config?.properties ?? [])
      .filter((p) => visibilityFullfilled(newValue, p))
      .map((p) => p.id);
    const visibilityDiff = Object.keys(newValue.attributes).filter((k) => !new_visible_properties.includes(k));
    if (visibilityDiff.length) visibilityDiff.forEach((p) => delete newValue.attributes?.[p]);
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

<!-- ============ CREATE MODE ============ -->
{#if !sel}
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
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Text weight="semibold">{modeTitle}</Text>
        <Badge variant="info">EDIT</Badge>
      </div>
      {#if category}
        <Text size="sm" class="text-muted-foreground">
          {category.label}
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
