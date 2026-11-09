<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon, Trash2Icon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";

  import type { Component, Snippet } from "svelte";

  // One compact row of a picked-media list: icon, name (and a detail line), what it
  // becomes, extra controls, and a remove button. Meant to sit in a bordered, divided list.
  interface Props {
    name: string;
    icon?: Component;
    title?: Snippet; // replaces the name, e.g. with a field to edit it
    details?: string; // second line, truncated (full text on hover)
    warning?: string; // shown after the details in the warning colour, e.g. "2 files ignored"
    meta?: string; // short note on the right, e.g. "3 datasets"
    onDelete: () => void;
    children?: Snippet; // controls before the remove button
    // When set, the detail line toggles `expansion`, shown under the row.
    expanded?: boolean;
    onToggle?: () => void;
    expansion?: Snippet;
  }
  let {
    name,
    icon: Icon,
    title,
    details,
    warning,
    meta,
    onDelete,
    children,
    expanded = false,
    onToggle,
    expansion,
  }: Props = $props();
</script>

<div class="px-3 py-2">
  <div class="flex items-center gap-3">
    {#if Icon}
      <Icon class="text-muted-foreground size-4 shrink-0" />
    {/if}

    <div class="min-w-0 flex-1">
      {#if title}
        {@render title()}
      {:else}
        <p class="truncate text-sm font-medium" title={name}>{name}</p>
      {/if}
      {#if details && onToggle}
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex max-w-full cursor-pointer items-center gap-0.5 text-xs"
          aria-expanded={expanded}
          onclick={onToggle}
        >
          <span class="truncate">
            {details}{#if warning}&nbsp;·&nbsp;<span class="text-amber-700 dark:text-amber-300">{warning}</span>{/if}
          </span>
          {#if expanded}
            <ChevronDownIcon class="size-3.5 shrink-0" />
          {:else}
            <ChevronRightIcon class="size-3.5 shrink-0" />
          {/if}
        </button>
      {:else if details}
        <p class="text-muted-foreground truncate text-xs" title={details}>{details}</p>
      {/if}
    </div>

    {#if meta}
      <span class="text-muted-foreground shrink-0 text-xs tabular-nums">{meta}</span>
    {/if}
    {@render children?.()}

    <Button variant="destructive-ghost" size="icon-sm" aria-label={`Remove ${name}`} onclick={onDelete}>
      <Trash2Icon />
    </Button>
  </div>

  {#if expanded && expansion}
    <div class="mt-1.5 ml-7">{@render expansion()}</div>
  {/if}
</div>
