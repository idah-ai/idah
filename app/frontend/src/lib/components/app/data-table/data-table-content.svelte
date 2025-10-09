<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div id="data-table-content" class={cn("border-border flex flex-col overflow-x-auto rounded-lg border", className)}>
  {@render children?.()}
</div>
