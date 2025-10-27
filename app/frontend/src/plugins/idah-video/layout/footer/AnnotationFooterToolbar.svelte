<script lang="ts">
  import { cn, type WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class={cn("flex items-center gap-4 p-2", className)}>
  {@render children?.()}
</div>
