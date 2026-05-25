<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn } from "$lib/utils.js";

  // Props
  let { class: className, children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<kbd
  data-slot="kbd"
  class={cn(
    "bg-secondary text-secondary-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none",
    "[&_svg:not([class*='size-'])]:size-3",
    "in-data-[slot=tooltip-content]:bg-secondary in-data-[slot=tooltip-content]:text-secondary-foreground dark:in-data-[slot=tooltip-content]:text-secondary-foreground",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</kbd>
