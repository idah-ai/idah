<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "$lib/utils";

  // Props
  let {
    panelHeight = $bindable(0),
    class: className,
    children,
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    panelHeight: number;
  } = $props();
</script>

<div class={cn("z-40 h-full", className)} bind:clientHeight={panelHeight}>
  {@render children?.()}
</div>
