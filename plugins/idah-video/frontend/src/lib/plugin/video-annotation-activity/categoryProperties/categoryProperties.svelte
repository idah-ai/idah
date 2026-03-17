<script lang="ts">
  import { getContext } from "svelte";

  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "$lib/components/ui/select";
  import SelectGroup from "$lib/components/ui/select/select-group.svelte";
  import { Separator } from "$lib/components/ui/separator";
  import Text from "$lib/components/ui/text/Text.svelte";

  import VectorSquareIcon from "../../layout/sidebar/category/vector-sqaure-icon.svelte";
  import BooleanProperty from "./properties/booleanProperty.svelte";
  import IntegerProperty from "./properties/integerProperty.svelte";
  import MultiSelectProperty from "./properties/MultiSelectProperty.svelte";
  import SingleSelectProperty from "./properties/SingleSelectProperty.svelte";
  import TextProperty from "./properties/textProperty.svelte";

  import { truncate } from "$lib/utils/string";

  import { visibilityFullfilled } from ".";
  import { idb_updated_at } from "../idb_store.svelte";
  import { selectedAnnotationGroup } from "../store";

  import type { AnnotationValue } from "$idah/context/AnnotationContext";
  import type {
    IActivityContext,
    IConfigProperty,
  } from "$idah/context/ActivityContext";

  type Props = {
    mode: string;
    selectedCategory: string;
    annotationId?: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    onEditValue: (value?: AnnotationValue) => void;
    disabled: boolean;
  };

  let {
    mode,
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
  let configByMode = $derived(context.config[mode]);
  let category = $derived(
    configByMode?.values?.find((c) => c.id == selectedCategory),
  );
  let properties = $derived(
    configByMode?.properties?.filter((p) =>
      visibilityFullfilled(annotationValue, p),
    ),
  );

  let firstAnnotationInGroup = $derived(
    $selectedAnnotationGroup?.annotations[0],
  );
  let configByGroup = $derived(
    firstAnnotationInGroup
      ? context.config[firstAnnotationInGroup.shape.type]
      : { values: [], properties: [] },
  );
  let firstAnnotationInGroupCategory = $derived(
    firstAnnotationInGroup?.value.category,
  );
  let foundAnnotationInGroupCategory = $derived(
    configByGroup.values.find(
      (c) => c.id == firstAnnotationInGroup?.value.category,
    ),
  );

  const propertyComponents: {
    type: string;
    component:
      | typeof TextProperty
      | typeof IntegerProperty
      | typeof BooleanProperty
      | typeof SingleSelectProperty
      | typeof MultiSelectProperty;
  }[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    { type: "single-select", component: SingleSelectProperty },
    { type: "multi-select", component: MultiSelectProperty },
  ];

  function getModeTitle() {
    return ((s: string) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""))(
      mode.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "),
    );
  }

  function onValueChange(
    property: IConfigProperty,
    v: string | number | string[] | undefined | boolean,
  ) {
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
    const visibilityDiff = Object.keys(newValue.attributes).filter(
      (k) => !new_visible_properties.includes(k),
    );
    // remove visibility false properties
    if (visibilityDiff.length)
      visibilityDiff.forEach((p) => delete newValue.attributes?.[p]);
    onEditValue(newValue);
  }

  function reselectCategory(reselectedCategoryId: string) {
    $selectedAnnotationGroup?.annotations.forEach((annotation) => {
      annotation.value.category = reselectedCategoryId;
    });
    onReSelectCategory?.(reselectedCategoryId);
  }
</script>

{#snippet SelectCategory()}
  {#if configByMode}
    <section class="flex flex-col gap-2">
      <!-- SELECT::LABEL -->
      <Text weight="semibold" size="sm">
        {getModeTitle()}
      </Text>

      <Select type="single" onValueChange={onSelectCategory} {disabled}>
        <SelectTrigger
          class="data-[placeholder]:text-secondary-foreground bg-secondary w-full truncate text-xs"
        >
          <div class="flex gap-1">
            {#if category?.label}
              <VectorSquareIcon color={category.color} />
              {truncate(category.label)}
            {:else}
              Select category
            {/if}
          </div>
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            {#each configByMode.values as { id: value, label, color } (value)}
              <SelectItem class="text-xs" {label} {value}>
                <VectorSquareIcon {color} />
                {label}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Separator />
    </section>
  {/if}
{/snippet}

{#snippet ReSelectCategory()}
  <section class="flex flex-col gap-2">
    <!-- SELECT::LABEL -->
    <Text weight="semibold" size="sm">Category</Text>

    <Select type="single" onValueChange={reselectCategory} {disabled}>
      <SelectTrigger
        class="data-[placeholder]:text-secondary-foreground bg-secondary w-full truncate text-xs"
      >
        <div class="flex gap-1">
          {#if foundAnnotationInGroupCategory?.label}
            <VectorSquareIcon color={foundAnnotationInGroupCategory.color} />
            {truncate(foundAnnotationInGroupCategory.label)}
          {:else}
            Select category
          {/if}
        </div>
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {#each configByGroup.values as { id: value, label, color } (value)}
            <SelectItem
              class="text-xs"
              {label}
              {value}
              disabled={firstAnnotationInGroupCategory == value}
            >
              <VectorSquareIcon {color} />
              {label}
            </SelectItem>
          {/each}
        </SelectGroup>
      </SelectContent>
    </Select>

    <Separator />
  </section>
{/snippet}

{#key $idb_updated_at}
  <!-- CATEGORIES -->
  {#if annotationId}
    <!--
        If annotationId provided (annotation already created)
        - We don't allow to change the category when select annotation
        - We only allow to edit the properties
        - We only allow to edit the categories at group level
      -->
  {:else if $selectedAnnotationGroup && !annotationId}
    {@render ReSelectCategory()}
  {:else}
    {@render SelectCategory()}
  {/if}

  <!-- PROPERTIES -->
  <div class="flex flex-col gap-4">
    {#if category && properties?.length > 0}
      <section class="flex flex-col gap-2">
        <Text class="mb-2" weight="semibold" size="sm">Properties</Text>

        {#each properties as property (property.id)}
          {@const foundPropertyComponent = propertyComponents.find(
            (p) => p.type == property.type,
          )}

          {#if foundPropertyComponent}
            <div class="flex flex-col gap-1">
              <foundPropertyComponent.component
                {...{
                  property,
                  value: annotationValue.attributes?.[property.id],
                  onValueChange: (
                    v: string | number | boolean | string[] | undefined,
                  ) => onValueChange(property, v),
                  disabled,
                }}
              />
            </div>
          {/if}
        {/each}
      </section>
    {/if}
  </div>
{/key}
