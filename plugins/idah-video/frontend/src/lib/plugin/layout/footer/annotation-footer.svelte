<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "$lib/utils";

  // Props
  let {
    annotationFooterHeight = $bindable(0),
    class: className,
    children
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    annotationFooterHeight: number;
  } = $props();
</script>

<div
  class={cn("z-40 h-full", className)}
  bind:clientHeight={annotationFooterHeight}
>
  {@render children?.()}
</div>
