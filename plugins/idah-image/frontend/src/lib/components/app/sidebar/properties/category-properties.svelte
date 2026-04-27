<script lang="ts">
  import { getContext } from "svelte";

  import { visibilityFullfilled } from "$lib/components/app/sidebar/properties/properties.index";
  import Label from "$lib/components/ui/label/label.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import Separator from "$lib/components/ui/separator/separator.svelte";

  import BooleanProperty from "$lib/components/app/sidebar/properties/boolean-property.svelte";
  import IntegerProperty from "$lib/components/app/sidebar/properties/integer-property.svelte";
  import MultiSelectProperty from "$lib/components/app/sidebar/properties/multi-select-property.svelte";
  import SingleSelectProperty from "$lib/components/app/sidebar/properties/single-select-property.svelte";
  import TextProperty from "$lib/components/app/sidebar/properties/text-property.svelte";

  import PolygonCircleIcon from "$lib/plugin/icon/polygon-circle-icon.svelte";
  import VectorSquareIcon from "$lib/plugin/icon/vector-square-icon.svelte";

  import { currentMode, selectedAnnotationGroup } from "$lib/plugin/store/store";
  import { IMAGE_BOUNDING_BOX, IMAGE_POLYGON } from "$lib/plugin/types";

  import type { PropertyComponent } from "$lib/components/app/sidebar/properties/property.types";
  import { Badge } from "$lib/components/ui/badge";
  import type { AnnotationValue } from "$lib/context/annotation-context";
  import type { IActivityContext, IConfigProperty } from "$lib/context/context";

  // Props
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

  // Variables
  const propertyComponents: PropertyComponent[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    { type: "single-select", component: SingleSelectProperty },
    { type: "multi-select", component: MultiSelectProperty },
  ];

  // Functions
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
    <section class="flex flex-col gap-2">
      <!-- SELECT::LABEL -->
      <div class="flex items-center gap-2">
        <Label class="font-semibold">{getModeTitle()}</Label>
        <Badge variant="success-200">CREATE</Badge>
      </div>

      <div class="flex flex-col gap-1">
        <Label class="text-sm font-semibold">Category</Label>

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
                  {#if firstAnnotationInGroup?.shape.type === IMAGE_POLYGON}
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
                  {#if firstAnnotationInGroup?.shape.type === IMAGE_POLYGON}
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

      <Separator />
    </section>
  {/if}
{/snippet}

{#snippet ReSelectCategory()}
  <section class="flex flex-col gap-3">
    <!-- SELECT::LABEL -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Label class="font-semibold">
          {getModeTitle()}
        </Label>
        <Badge variant="info">EDIT</Badge>
      </div>

      {#if firstAnnotationInGroup}
        {@const groupId = firstAnnotationInGroup.metadata.metadata?.group_id ?? firstAnnotationInGroup.metadata.id}
        {@const splittedGroupId = groupId?.split("-")}
        {@const lastPartOfGroupId = splittedGroupId ? splittedGroupId[splittedGroupId.length - 1] : ""}
        {@const fallbackGroupTitle = `Group-${lastPartOfGroupId}`}

        <Label class="text-muted-foreground text-sm">
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
        </Label>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <Label class="text-sm font-semibold">Category</Label>
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
                {#if firstAnnotationInGroup?.shape.type === IMAGE_BOUNDING_BOX}
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
                {#if firstAnnotationInGroup?.shape.type === IMAGE_BOUNDING_BOX}
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
  <!--
        If annotationId provided (annotation already created)
        - We don't allow to change the category when select annotation
        - We only allow to edit the properties
        - We only allow to edit the categories at group level
      -->
  {@render ReSelectCategory()}
{:else}
  {@render SelectCategory()}
{/if}

<!-- PROPERTIES -->
<div class="flex flex-col gap-4">
  {#if category && properties?.length > 0}
    <section class="flex flex-col gap-2">
      <div class="flex flex-row items-center gap-2">
        <Label class="text-sm font-semibold">Properties</Label>

        <!-- Frame range -->
        {#if firstAnnotationInGroup}
          <Label class="text-muted-foreground text-xs">
            ( Frame :
            {firstAnnotationInGroup.shape.start} - {firstAnnotationInGroup.shape.end}
            )
          </Label>
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
