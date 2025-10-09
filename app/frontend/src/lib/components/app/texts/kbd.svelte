<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<kbd
  class={cn(
    "bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[0.75rem] font-medium",
    className,
  )}
>
  {@render children?.()}
</kbd>
