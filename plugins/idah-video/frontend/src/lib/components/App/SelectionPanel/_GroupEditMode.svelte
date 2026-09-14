<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";

  import type { IConfigValue } from "$idah/v2/types";

  type Props = {
    modeTitle: string;
    shapeType: string | undefined;
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    displayName: string;
    onReSelectCategory: (reselectedCategoryId?: string) => void;
    disabled: boolean;
  };

  let {
    modeTitle,
    shapeType,
    configValues,
    category,
    selectedCategory,
    displayName,
    onReSelectCategory,
    disabled,
  }: Props = $props();
</script>

<section class="flex flex-col gap-3">
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <Text weight="semibold">{modeTitle}</Text>
      <Badge variant="info">EDIT</Badge>
    </div>
    <Text size="sm" class="text-muted-foreground">
      {displayName}
    </Text>
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
</section>
