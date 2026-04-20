<script lang="ts">
  import { getContext } from "svelte";

  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import SelectGroup from "$lib/components/ui/select/select-group.svelte";
  import { Separator } from "$lib/components/ui/separator";
  import Text from "$lib/components/ui/text/Text.svelte";

  import PolygonCircleIcon from "$lib/plugin/icon/polygon-circle-icon.svelte";
  import VectorSquareIcon from "$lib/plugin/icon/vector-square-icon.svelte";

  import BooleanProperty from "$lib/plugin/video-annotation-activity/category-properties/properties/boolean-property.svelte";
  import IntegerProperty from "$lib/plugin/video-annotation-activity/category-properties/properties/integer-property.svelte";
  import MultipleSelectProperty from "$lib/plugin/video-annotation-activity/category-properties/properties/multiple-select-property.svelte";
  import SingleSelectProperty from "$lib/plugin/video-annotation-activity/category-properties/properties/single-select-property.svelte";
  import TextProperty from "$lib/plugin/video-annotation-activity/category-properties/properties/text-property.svelte";

  import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
  import { visibilityFullfilled } from "$lib/plugin/video-annotation-activity/category-properties";
  import { currentMode, selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";

  import type { IActivityContext, IConfigProperty } from "$idah/context/activity-context";
  import type { AnnotationValue } from "$idah/context/annotation-context";
  import Badge from "$lib/components/ui/badge/badge.svelte";

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

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let configByMode = $derived(context.config[$currentMode]);
  let category = $derived(configByMode?.values?.find((c) => c.id == selectedCategory));
  let properties = $derived(configByMode?.properties?.filter((p) => visibilityFullfilled(annotationValue, p)));

  let firstAnnotationInGroup = $derived($selectedAnnotationGroup?.annotations[0]);
  let configByGroup = $derived(
    firstAnnotationInGroup ? context.config[firstAnnotationInGroup.shape.type] : { values: [], properties: [] },
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
      $currentMode.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "),
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
    $selectedAnnotationGroup?.annotations.forEach((annotation) => {
      annotation.value.category = reselectedCategoryId;
    });
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
        <Badge variant="success-pastel">CREATE</Badge>
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
                    <PolygonCircleIcon color={category.color} />
                  {:else}
                    <VectorSquareIcon color={category.color} />
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
                    <PolygonCircleIcon {color} />
                  {:else}
                    <VectorSquareIcon {color} />
                  {/if}
                  {valueLabel}
                </SelectItem>
              {/each}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Separator class="my-3" />
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
        {@const groupId = firstAnnotationInGroup.metadata.metadata?.group_id ?? firstAnnotationInGroup.metadata.id}
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
                  <VectorSquareIcon color={foundAnnotationInGroupCategory.color} />
                {:else}
                  <PolygonCircleIcon color={foundAnnotationInGroupCategory.color} />
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
                  <VectorSquareIcon {color} />
                {:else}
                  <PolygonCircleIcon {color} />
                {/if}
                {valueLabel}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <Separator class="my-3" />
  </section>
{/snippet}

<!-- CATEGORIES -->
{#if annotationId}
  {@render ReSelectCategory()}
{:else}
  {@render SelectCategory()}
{/if}

<!-- PROPERTIES -->
<div class="flex flex-col gap-4">
  {#if category && properties?.length > 0}
    <section class="flex flex-col gap-2">
      <div class="flex flex-row items-center gap-2">
        <Text size="sm" weight="semibold">Properties</Text>

        <!-- Frame range -->
        {#if firstAnnotationInGroup}
          <Text size="xs" class="text-muted-foreground">
            ( Frame :
            {firstAnnotationInGroup.shape.start} - {firstAnnotationInGroup.shape.end}
            )
          </Text>
        {/if}
      </div>

      {#each properties as property, index (`${property.id}-${index}`)}
        {@const foundPropertyComponent = propertyComponents.find((p) => p.type == property.type)}

        {#if foundPropertyComponent}
          <div class="flex flex-col gap-1">
            <foundPropertyComponent.component
              {...{
                property,
                value: annotationValue.attributes?.[property.id],
                onValueChange: (v: string | number | boolean | string[] | undefined) => onValueChange(property, v),
                disabled,
              }}
            />
          </div>
        {/if}
      {/each}
    </section>
  {/if}
</div>
