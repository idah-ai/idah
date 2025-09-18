<script lang="ts">
  import { cn, type WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<kbd class={cn("bg-muted text-muted-foreground rounded border px-2.5 py-1 font-mono text-sm font-medium", className)}>
  {@render children?.()}
</kbd>
