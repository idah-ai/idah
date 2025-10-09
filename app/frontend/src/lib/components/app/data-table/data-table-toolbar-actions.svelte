<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div id="data-table-toolbar-actions" class={cn("ml-auto flex items-center justify-end gap-4", className)}>
  {@render children?.()}
</div>
