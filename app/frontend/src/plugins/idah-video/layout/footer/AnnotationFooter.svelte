<script lang="ts">
  import { cn, type WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class={cn("z-40 h-full", className)}>
  {@render children?.()}
</div>
