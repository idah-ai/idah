<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";

  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { selection } from "$lib/state/selection.svelte";
  import { cn } from "$lib/utils";

  import type { IConfigProperty, IConfigValue } from "$idah/v2/types";
  import type { IImageAnnotationRecord, IImageAnnotationValue } from "$lib/types";

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

  let annotation = $derived(selection.value as IImageAnnotationRecord | null);
  let displayName = $derived(category?.label ?? undefined);
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
      {#each getAnnotationActions( { items: [annotation], annotationId: annotation.id }, ) as { label, icon: Icon, disabled: actionDisabled, onClick }, index (index)}
        <CategoryAction
          {label}
          icon={Icon}
          onclick={(e) => {
            if (actionDisabled) return;
            e.stopPropagation();
            onClick(e);
          }}
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
</section>
