<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";

  import type { IConfigProperty, IConfigValue } from "$idah/v2/types";
  import type { IVideoAnnotationValue } from "$lib/types";

  type Props = {
    modeTitle: string;
    shapeType: string | undefined;
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    properties: IConfigProperty[];
    annotationValue: IVideoAnnotationValue;
    onSelectCategory: (selectedCategoryId?: string) => void;
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
    onSelectCategory,
    onValueChange,
    disabled,
  }: Props = $props();
</script>

<section class="flex flex-col gap-3">
  <div class="flex items-center gap-2">
    <Text weight="semibold">{modeTitle}</Text>
    <Badge variant="success-200">CREATE</Badge>
  </div>

  <CategorySelect
    {configValues}
    {category}
    {selectedCategory}
    {shapeType}
    onValueChange={onSelectCategory}
    {disabled}
  />

  {#if properties.length > 0}
    <PropertiesSection {properties} {annotationValue} {onValueChange} {disabled} />
  {/if}
</section>
