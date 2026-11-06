<script lang="ts">
  import { CheckIcon, ChevronDownIcon } from "@lucide/svelte";
  import { useId } from "bits-ui";
  import { tick } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import * as Command from "$lib/components/ui/Command";
  import * as Field from "$lib/components/ui/Field";
  import * as Popover from "$lib/components/ui/Popover";

  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import type { IConfigValue } from "$idah/v2/types";

  type Props = {
    configValues: IConfigValue[];
    category: IConfigValue | undefined;
    selectedCategory: string;
    shapeType: string | undefined;
    onValueChange: (value?: string) => void;
    disabled: boolean;
    placeholder?: string;
    showShapeIcon?: boolean;
    /** Category ids to disable in the picker (e.g. already-used categories). */
    disabledValues?: Set<string>;
  };

  let {
    configValues,
    category,
    selectedCategory,
    shapeType,
    onValueChange,
    disabled,
    placeholder,
    showShapeIcon = true,
    disabledValues,
  }: Props = $props();

  const triggerId = useId();
  let open = $state(false);
  let search = $state("");
  let triggerRef = $state<HTMLButtonElement>(null!);

  function selectCategory(value: string) {
    onValueChange(value);
    open = false;
    search = "";
    tick().then(() => triggerRef?.focus());
  }
</script>

<Field.Field>
  <Field.Label for={triggerId} class="text-sm font-semibold">Category</Field.Label>
  <Popover.Root bind:open onOpenChange={(next) => { if (!next) search = ""; }}>
    <Popover.Trigger bind:ref={triggerRef}>
      {#snippet child({ props })}
        <Button
          {...props}
          id={triggerId}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          {disabled}
          class="bg-background h-auto! min-h-9 w-full min-w-0 justify-between py-2 text-left text-xs font-normal"
        >
          {#if category?.label}
            {@const parentLabel = categoryValueToLabel(category.id)}
            <span class="flex min-w-0 flex-col gap-1">
              {#if parentLabel.length > 0}
                <span class="whitespace-break-spaces">{parentLabel}</span>
              {/if}
              <span class="flex min-w-0 items-center gap-1">
                {#if showShapeIcon}
                  <ShapeIcon {shapeType} color={category.color} />
                {/if}
                <b class="truncate">{category.label}</b>
              </span>
            </span>
          {:else}
            <span class="text-muted-foreground">{placeholder || "Select category"}</span>
          {/if}
          <ChevronDownIcon class="text-muted-foreground ml-auto size-4 shrink-0" />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" class="w-[var(--bits-popover-anchor-width)] max-w-[calc(100vw-1rem)] p-0">
      <Command.Root label="Categories">
        <Command.Input bind:value={search} placeholder="Search categories..." />
        <Command.List>
          <Command.Empty>No categories found.</Command.Empty>
          <Command.Group>
            {#each configValues as { id: value, label, color }, index (`${value}-${index}`)}
              {@const valueLabel = categoryValueToLabel(value, label)}
              <Command.Item
                value={value}
                keywords={[valueLabel, label]}
                class="text-xs"
                disabled={selectedCategory === value || disabledValues?.has(value)}
                onSelect={() => selectCategory(value)}
              >
                {#if showShapeIcon}
                  <ShapeIcon {shapeType} {color} />
                {/if}
                <span class="min-w-0 flex-1 whitespace-normal">{valueLabel}</span>
                {#if selectedCategory === value}
                  <CheckIcon class="ml-auto size-4 shrink-0" />
                {/if}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</Field.Field>
