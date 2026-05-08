<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import BooleanProperty from "$lib/components/App/PropertySelector/Properties/_BooleanProperty.svelte";
  import IntegerProperty from "$lib/components/App/PropertySelector/Properties/_IntegerProperty.svelte";
  import MultipleSelectProperty from "$lib/components/App/PropertySelector/Properties/_MultipleSelectProperty.svelte";
  import SingleSelectProperty from "$lib/components/App/PropertySelector/Properties/_SingleSelectProperty.svelte";
  import TextProperty from "$lib/components/App/PropertySelector/Properties/_TextProperty.svelte";

  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$idah/v2/video-types";
  import { visibilityFullfilled } from "$lib/components/App/PropertySelector";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { AnnotationValue } from "$idah/context/annotation-context";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";

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

  // Variables
  let mode = $derived(viewport.mode);
  let configByMode = $derived(getDriver().config[mode]);
  let category = $derived(configByMode?.values?.find((c) => c.id == selectedCategory));
  let properties = $derived(configByMode?.properties?.filter((p) => visibilityFullfilled(annotationValue, p)));

  let firstAnnotationInGroup = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" ? (v as any).annotations?.[0] : undefined;
  });
  let configByGroup = $derived(
    firstAnnotationInGroup ? getDriver().config[firstAnnotationInGroup.shape.type] : { values: [], properties: [] },
  );
  let firstAnnotationInGroupCategory = $derived(firstAnnotationInGroup?.value.category);
  let foundAnnotationInGroupCategory = $derived(
    configByGroup.values.find((c) => c.id == firstAnnotationInGroup?.value.category),
  );

  const propertyComponents: {
    type: string;
    component:
      | typeof TextProperty
      | typeof IntegerProperty
      | typeof BooleanProperty
      | typeof SingleSelectProperty
      | typeof MultipleSelectProperty;
  }[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    { type: "single-select", component: SingleSelectProperty },
    { type: "multi-select", component: MultipleSelectProperty },
  ];

    function getModeTitle() {
    return ((s: string) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""))(
      mode.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "),
    );
  }

  function onValueChange(property: IConfigProperty, v: string | number | string[] | undefined | boolean) {
    const newValue = {
      ...annotationValue,
      attributes: {
        ...(annotationValue.attributes || {}),
        [property.id]: v,
      },
    };
    const new_visible_properties = configByMode?.properties
      .filter((p) => visibilityFullfilled(newValue, p))
      .map((p) => p.id);
    const visibilityDiff = Object.keys(newValue.attributes).filter((k) => !new_visible_properties.includes(k));
    // remove visibility false properties
    if (visibilityDiff.length) visibilityDiff.forEach((p) => delete newValue.attributes?.[p]);
    onEditValue(newValue);
  }

  function reselectCategory(reselectedCategoryId: string) {
    const v = selection.value;
    if (v?.type === "group") {
      (v as any).annotations.forEach((annotation: any) => {
        if (annotation.value) annotation.value.category = reselectedCategoryId;
      });
    }
    onReSelectCategory?.(reselectedCategoryId);
  }

  function categoryValueToLabel(value?: string, replaceLabel?: string) {
    if (!value) return "";

    const label = value.split("/").map((s) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""));

    if (replaceLabel) {
      label[label.length - 1] = replaceLabel;
    } else {
      // remove the last part of array
      label.pop();
    }

    return label.join(" / ");
  }
</script>

{#snippet SelectCategory()}
  {#if configByMode}
    <section class="flex flex-col gap-3">
      <!-- SELECT::LABEL -->
      <div class="flex items-center gap-2">
        <Text weight="semibold">
          {getModeTitle()}
        </Text>
        <Badge variant="success-200">CREATE</Badge>
      </div>

      <div class="flex flex-col gap-1">
        <Text size="sm" weight="semibold">Category</Text>
        <Select type="single" onValueChange={onSelectCategory} {disabled}>
          <SelectTrigger
            class="data-placeholder:text-secondary-foreground bg-secondary h-auto! w-full truncate py-2 text-xs"
          >
            {#if category?.label}
              {@const parentLabel = categoryValueToLabel(category.id)}

              <div class="flex flex-col gap-1 text-left">
                {#if parentLabel.length > 0}
                  <div class="whitespace-break-spaces">
                    {parentLabel}
                  </div>
                {/if}
                <div class="flex items-center justify-start gap-1">
                  <!-- TO FIX: firstAnnotationInGroup does not have value -->
                  {#if firstAnnotationInGroup?.shape.type === IDAH_VIDEO_POLYGON}
                    <Icon src={polygonIconSvg} color={category.color} />
                  {:else}
                    <Icon src={vectorSquareIconSvg} color={category.color} />
                  {/if}
                  <b>{category.label}</b>
                </div>
              </div>
            {/if}
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              {#each configByMode.values as { id: value, label, color }, index (`${value}-${index}`)}
                {@const valueLabel = categoryValueToLabel(value, label)}
                <SelectItem
                  label={valueLabel}
                  {value}
                  class={"text-xs " + (category?.id == value ? "bg-primary/20 opacity-100!" : "")}
                  disabled={category?.id == value}
                >
                  <!-- TO FIX: firstAnnotationInGroup does not have value -->
                  {#if firstAnnotationInGroup?.shape.type === IDAH_VIDEO_POLYGON}
                    <Icon src={polygonIconSvg} {color} />
                  {:else}
                    <Icon src={vectorSquareIconSvg} {color} />
                  {/if}
                  {valueLabel}
                </SelectItem>
              {/each}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </section>
  {/if}
{/snippet}

{#snippet ReSelectCategory()}
  <section class="flex flex-col gap-3">
    <!-- SELECT::LABEL -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Text weight="semibold">
          {getModeTitle()}
        </Text>
        <Badge variant="info">EDIT</Badge>
      </div>

      {#if firstAnnotationInGroup}
        {@const groupId = firstAnnotationInGroup.metadata?.group_id ?? firstAnnotationInGroup.metadata?.id}
        {@const splittedGroupId = groupId?.split("-")}
        {@const lastPartOfGroupId = splittedGroupId ? splittedGroupId[splittedGroupId.length - 1] : ""}
        {@const fallbackGroupTitle = `Group-${lastPartOfGroupId}`}

        <Text size="sm" class="text-muted-foreground">
          {#if firstAnnotationInGroup.value.category}
            {@const foundCategory = configByGroup.values.find((c) => c.id == firstAnnotationInGroup.value.category)}
            {#if foundCategory}
              {foundCategory.label}-{lastPartOfGroupId}
            {:else}
              {fallbackGroupTitle}
            {/if}
          {:else}
            {fallbackGroupTitle}
          {/if}
        </Text>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <Text size="sm" weight="semibold">Category</Text>
      <Select type="single" onValueChange={reselectCategory} {disabled}>
        <SelectTrigger
          class="data-placeholder:text-secondary-foreground bg-secondary h-auto! w-full truncate py-2 text-xs"
        >
          {#if foundAnnotationInGroupCategory?.label}
            {@const parentLabel = categoryValueToLabel(foundAnnotationInGroupCategory.id)}

            <div class="flex flex-col gap-1 text-left">
              {#if parentLabel.length > 0}
                <div class="whitespace-break-spaces">
                  {parentLabel}
                </div>
              {/if}
              <div class="flex items-center justify-start gap-1">
                {#if firstAnnotationInGroup?.shape.type === IDAH_VIDEO_BOUNDING_BOX}
                  <Icon src={vectorSquareIconSvg} color={foundAnnotationInGroupCategory.color} />
                {:else}
                  <Icon src={polygonIconSvg} color={foundAnnotationInGroupCategory.color} />
                {/if}
                <b>{foundAnnotationInGroupCategory.label}</b>
              </div>
            </div>
          {:else}
            Select category
          {/if}
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            {#each configByGroup.values as { id: value, label, color }, index (`${value}-${index}`)}
              {@const valueLabel = categoryValueToLabel(value, label)}
              <SelectItem
                class={"text-xs " + (firstAnnotationInGroupCategory == value ? "bg-primary/20 opacity-100!" : "")}
                label={valueLabel}
                {value}
                disabled={firstAnnotationInGroupCategory == value}
              >
                {#if firstAnnotationInGroup?.shape.type === IDAH_VIDEO_BOUNDING_BOX}
                  <Icon src={vectorSquareIconSvg} {color} />
                {:else}
                  <Icon src={polygonIconSvg} {color} />
                {/if}
                {valueLabel}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <!-- Frame range -->
    {#if firstAnnotationInGroup}
      <div class="flex items-center gap-1">
        <Text size="sm" weight="semibold">Frame :</Text>
        <Text size="xs" class="text-muted-foreground">
          {firstAnnotationInGroup.shape.start} - {firstAnnotationInGroup.shape.end}
        </Text>
      </div>
    {/if}
  </section>
{/snippet}

<!-- CATEGORIES -->
{#if annotationId}
  {@render ReSelectCategory()}
{:else}
  {@render SelectCategory()}
{/if}

<!-- PROPERTIES -->
<div class="flex flex-col gap-3">
  {#if category && properties?.length > 0}
    <Separator class="mt-3" />

    <section class="flex flex-col gap-2">
      <div class="flex flex-row items-center gap-2">
        <Text size="sm" weight="semibold">Properties</Text>
      </div>

      {#each properties as property, index (`${property.id}-${index}`)}
        <div class="flex flex-col gap-1">
          {#if property.type === "text"}
            <TextProperty
              {property}
              value={annotationValue.attributes?.[property.id] as any}
              onValueChange={(v: any) => onValueChange(property, v)}
              {disabled}
            />
          {:else if property.type === "integer"}
            <IntegerProperty
              {property}
              value={annotationValue.attributes?.[property.id] as any}
              onValueChange={(v: any) => onValueChange(property, v)}
              {disabled}
            />
          {:else if property.type === "boolean"}
            <BooleanProperty
              {property}
              value={annotationValue.attributes?.[property.id] as any}
              onValueChange={(v: any) => onValueChange(property, v)}
              {disabled}
            />
          {:else if property.type === "single-select"}
            <SingleSelectProperty
              {property}
              value={annotationValue.attributes?.[property.id] as any}
              onValueChange={(v: any) => onValueChange(property, v)}
              {disabled}
            />
          {:else if property.type === "multi-select"}
            <MultipleSelectProperty
              {property}
              value={annotationValue.attributes?.[property.id] as any}
              onValueChange={(v: any) => onValueChange(property, v)}
              {disabled}
            />
          {/if}
        </div>
      {/each}
    </section>
  {/if}
</div>
