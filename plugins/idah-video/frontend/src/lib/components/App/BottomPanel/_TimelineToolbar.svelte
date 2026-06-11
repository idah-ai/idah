<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "$lib/utils";

  // Props
  let {
    toolbarHeight = $bindable(0),
    class: className,
    children,
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    toolbarHeight: number;
  } = $props();
</script>

<div
  class={cn("flex min-h-12 items-center gap-4 px-4 py-2", className)}
  bind:clientHeight={toolbarHeight}
>
  {@render children?.()}
</div>
