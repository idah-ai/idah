<script lang="ts">
  import { PlusIcon, Trash2Icon } from "@lucide/svelte";

  import VisibilityCondition from "@/components/app/datasets/labels/properties/visibility/visibility-condition.svelte";
  import VisibilityGroup from "@/components/app/datasets/labels/properties/visibility/visibility-group.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

  import {
    defaultCondition,
    selectableFields,
    type VisibilityField,
  } from "@/components/app/datasets/labels/properties/visibility/visibility-fields";
  import { cn } from "@/utils";
  import { isRuleGroup, newGroup, type RuleGroup, type RuleItem } from "@/utils/visibility_rules";

  // Props
  interface Props {
    group: RuleGroup;
    fields: VisibilityField[];
    /** The top-level group, which has no border and can't be removed. */
    root?: boolean;
    onChange: (group: RuleGroup) => void;
    onRemove?: () => void;
  }
  let { group, fields, root = false, onChange, onRemove }: Props = $props();

  // Variables
  let canAdd = $derived(selectableFields(fields).length > 0);

  // Functions
  function setItem(index: number, item: RuleItem) {
    // A nested group left with no conditions is removed.
    const items =
      isRuleGroup(item) && item.items.length === 0
        ? group.items.filter((_, i) => i !== index)
        : group.items.map((current, i) => (i === index ? item : current));
    onChange({ ...group, items });
  }

  function removeItem(index: number) {
    onChange({ ...group, items: group.items.filter((_, i) => i !== index) });
  }

  function addCondition() {
    const condition = defaultCondition(fields);
    if (condition) onChange({ ...group, items: [...group.items, condition] });
  }

  function addGroup() {
    const first = defaultCondition(fields);
    const second = defaultCondition(fields);
    if (first && second) onChange({ ...group, items: [...group.items, newGroup("any", [first, second])] });
  }
</script>

{#snippet modeSelect()}
  <Select
    type="single"
    value={group.mode}
    onValueChange={(mode) => onChange({ ...group, mode: mode as RuleGroup["mode"] })}
  >
    <SelectTrigger size="sm" class="gap-1 px-1.5 text-xs data-[size=sm]:h-6" aria-label="Match all or any"
      >{group.mode}</SelectTrigger
    >
    <SelectContent>
      <SelectItem value="all" label="all" />
      <SelectItem value="any" label="any" />
    </SelectContent>
  </Select>
{/snippet}

<div class={cn("flex min-w-0 flex-col gap-1", !root && "border-l-2 pl-2")}>
  <!-- GROUP::HEADER -->
  {#if root}
    {#if group.items.length > 1}
      <div class="text-muted-foreground flex items-center gap-1 text-xs">
        Show when {@render modeSelect()} of these match
      </div>
    {/if}
  {:else}
    <div class="text-muted-foreground flex h-7 items-center justify-between gap-1 text-xs">
      <div class="flex items-center gap-1">
        {#if group.items.length > 1}
          {@render modeSelect()} of these
        {:else}
          Group
        {/if}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground size-6"
        aria-label="Remove group"
        onclick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </div>
  {/if}

  <!-- GROUP::ITEMS -->
  {#if root && group.items.length === 0}
    <p class="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
      No conditions. This property is always shown.
    </p>
  {/if}

  {#each group.items as item, index (item.id)}
    <div class="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-1">
      <span class="text-muted-foreground h-7 text-right text-[11px] leading-7">
        {index === 0 ? "if" : group.mode === "all" ? "and" : "or"}
      </span>

      {#if isRuleGroup(item)}
        <VisibilityGroup
          group={item}
          {fields}
          onChange={(next) => setItem(index, next)}
          onRemove={() => removeItem(index)}
        />
      {:else}
        <VisibilityCondition
          condition={item}
          {fields}
          onChange={(next) => setItem(index, next)}
          onRemove={() => removeItem(index)}
        />
      {/if}
    </div>
  {/each}

  <!-- GROUP::ADD -->
  {#if canAdd}
    <div class={cn("flex gap-1", group.items.length > 0 && "pl-7")}>
      <Button variant="ghost" size="xs" class="text-muted-foreground" onclick={addCondition}>
        <PlusIcon />
        Condition
      </Button>
      <Button variant="ghost" size="xs" class="text-muted-foreground" onclick={addGroup}>
        <PlusIcon />
        Group
      </Button>
    </div>
  {/if}
</div>
