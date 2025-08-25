<script lang="ts">
  import { cn, type WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  let { ref = $bindable(null), class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} class={cn("flex h-screen w-full flex-col", className)}>
  {@render children?.()}
</div>
