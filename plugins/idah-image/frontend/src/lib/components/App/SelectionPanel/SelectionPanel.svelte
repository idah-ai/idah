<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Icon from "$lib/components/ui/Icon";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";

  import BooleanProperty from "$lib/components/App/SelectionPanel/Properties/_BooleanProperty.svelte";
  import IntegerProperty from "$lib/components/App/SelectionPanel/Properties/_IntegerProperty.svelte";
  import MultipleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_MultipleSelectProperty.svelte";
  import SingleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_SingleSelectProperty.svelte";
  import TextProperty from "$lib/components/App/SelectionPanel/Properties/_TextProperty.svelte";

  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { annotation } from "$lib/state/annotation.svelte";
  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { DEFAULT_MODE, IMAGE_POLYGON } from "$lib/types";
  import { cn } from "$lib/utils";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { Menus } from "$lib/components/App/ContextMenu/types";
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

  let effectiveSelectedCategory = $derived(selectedCategory);

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

  // -----------------------------------------------------------------------
  // All annotations (for default mode, no selection)
  // -----------------------------------------------------------------------
  let currentFrameAnnotations = $derived.by<IImageAnnotationRecord[]>(() => {
    if (!data.annotations) return [];
    return data.annotations.items as unknown as IImageAnnotationRecord[];
  });

  const isAllHidden = $derived(
    currentFrameAnnotations.length > 0 && currentFrameAnnotations.every((ann) => annotation.isHidden(ann)),
  );
  const isAllLocked = $derived(
    currentFrameAnnotations.length > 0 && currentFrameAnnotations.every((ann) => annotation.isLocked(ann)),
  );

  const isSomeLocked = $derived(
    currentFrameAnnotations.length > 0 && currentFrameAnnotations.some((ann) => annotation.isLocked(ann)),
  );

  const menus = $derived<Menus>({
    actions: {
      items: {
        "visibility-all": {
          label: "Show/Hide All",
          icon: isAllHidden ? EyeOffIcon : EyeIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_visibility_all");
          },
        },
        "editability-all": {
          label: "Lock/Unlock All",
          icon: isAllLocked ? LockIcon : LockOpenIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_editability_all");
          },
        },
        "delete-all": {
          label: "Delete all annotations",
          icon: Trash2Icon,
          disabled: isSomeLocked,
          onClick: () => {
            showConfirmDialog({
              title: "Delete all annotations",
              description: "Are you sure you want to delete all annotations?",
              onConfirm: () => getDriver().command.call("annotation.delete_all"),
            });
          },
        },
      },
    },
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
  {#if shapeType === IMAGE_POLYGON}
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
  {#if (viewport.mode === DEFAULT_MODE || viewport.mode === "review") && currentFrameAnnotations.length > 0}
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Text weight="semibold">Annotations</Text>
        <Badge variant="secondary">{currentFrameAnnotations.length}</Badge>

        <div class="ml-auto flex items-center">
          {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, onClick, disabled }] (key)}
            <CategoryAction {label} icon={Icon} {disabled} onclick={onClick} />
          {/each}
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <Separator class="my-2" />
        {#each currentFrameAnnotations as ann (ann.id)}
          {@const annShapeType = ann.shape.type as string}
          {@const annConfig = getDriver().config[annShapeType]}
          {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
          {@const annColor = annCategory?.color ?? null}
          {@const annDisplayName = annCategory?.label ?? (ann.value?.category ?? "Uncategorized")}
          {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
          <div class="group hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs">
            <button
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
              onclick={() => selection.selectAnnotation(ann)}
            >
              {#if annShapeType === IMAGE_POLYGON}
                <Icon src={polygonIconSvg} color={annColor} />
              {:else}
                <Icon src={vectorSquareIconSvg} color={annColor} />
              {/if}
              <div class="flex min-w-0 flex-col">
                {#if annParentLabel.length > 0}
                  <span class="text-muted-foreground truncate text-xs">{annParentLabel}</span>
                {/if}
                <span class="truncate">{annDisplayName}</span>
              </div>
            </button>

            <div class="ml-auto flex shrink-0 items-center gap-0">
              {#each getAnnotationActions( { items: [ann], annotationId: ann.id }, ) as { label, icon: Icon, disabled, onClick, alwaysShow }, index (index)}
                <CategoryAction
                  {label}
                  icon={Icon}
                  onclick={(e) => {
                    if (disabled) return;
                    e.stopPropagation();
                    onClick(e);
                  }}
                  class={cn("opacity-0", {
                    "opacity-100": alwaysShow,
                    "group-hover:opacity-100": !alwaysShow && !disabled,
                    "cursor-not-allowed group-hover:opacity-30": disabled,
                  })}
                ></CategoryAction>
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
          <SelectTrigger
            class="data-placeholder:text-secondary-foreground bg-background h-auto! w-full truncate py-2 text-xs"
          >
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

  <!-- ============ ANNOTATION SELECTION ============ -->
{:else if sel}
  {@const selAnnDisplayName = category?.label ?? undefined}
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
        <SelectTrigger
          class="data-placeholder:text-secondary-foreground bg-background h-auto! w-full truncate py-2 text-xs"
        >
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
