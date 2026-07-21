<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/Select";
  import SelectGroup from "$lib/components/ui/Select/SelectGroup.svelte";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import { IMAGE_MASK } from "$lib/types";
  import type { IConfigValue } from "$idah/v2/types";

  type Props = {
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    shapeType: string | undefined;
    onValueChange: (value?: string) => void;
    disabled: boolean;
    placeholder?: string;
    usedMaskCategories?: Set<string>;
  };

  let { configValues, category, selectedCategory, shapeType, onValueChange, disabled, placeholder, usedMaskCategories = new Set<string>() }: Props = $props();
</script>

<div class="flex flex-col gap-1">
  <Text size="sm" weight="semibold">Category</Text>
  <Select type="single" {onValueChange} {disabled}>
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
            <ShapeIcon {shapeType} color={category.color} />
            <b>{category.label}</b>
          </div>
        </div>
      {:else if placeholder}
        {placeholder}
      {/if}
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {#each configValues as { id: value, label, color }, index (`${value}-${index}`)}
          {@const valueLabel = categoryValueToLabel(value, label)}
          {@const isMaskCategoryBlocked = shapeType === IMAGE_MASK && usedMaskCategories.has(value) && value !== selectedCategory}
          {@const isDisabled = disabled || isMaskCategoryBlocked}
          <SelectItem
            {value}
            label={valueLabel}
            class={"text-xs " + (selectedCategory == value ? "bg-primary/20 opacity-100!" : "")}
            disabled={isDisabled}
            title={isMaskCategoryBlocked ? "Already used by another mask on this entry" : undefined}
          >
            <ShapeIcon {shapeType} {color} />
            {valueLabel}
            {#if isMaskCategoryBlocked}
              <span class="text-[0.625rem] text-red-400 dark:text-red-500">
                Category already in use
              </span>
            {/if}
          </SelectItem>
        {/each}
      </SelectGroup>
    </SelectContent>
  </Select>
</div>
