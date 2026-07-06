<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";

  import type { IConfigProperty, IConfigValue } from "$idah/v2/types";
  import type { IImageAnnotationValue } from "$lib/types";

  type Props = {
    modeTitle: string;
    shapeType: string | undefined;
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    properties: IConfigProperty[];
    annotationValue: IImageAnnotationValue;
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
    onReSelectCategory,
    onValueChange,
    disabled,
  }: Props = $props();

  let displayName = $derived(category?.label ?? undefined);
</script>

<section class="flex flex-col gap-3">
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
</section>
