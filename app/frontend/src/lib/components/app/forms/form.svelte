<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLDivElement>>;
  let { ref, class: className, children }: Props = $props();
</script>

<div bind:this={ref} class={cn("grid gap-4 px-1", className)}>
  {@render children?.()}
</div>
