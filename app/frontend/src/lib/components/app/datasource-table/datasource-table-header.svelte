<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div id="datasource-table-header" class={cn("flex w-full items-center justify-between gap-4", className)}>
  {@render children?.()}
</div>
