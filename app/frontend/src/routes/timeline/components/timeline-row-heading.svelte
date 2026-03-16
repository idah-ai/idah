<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "@/utils";

  // Props
  interface Props {
    children?: Snippet;
    class?: string | null;
  }
  let { children, class: className }: Props = $props();
</script>

<p class={cn("font-regular truncate text-xs", className)}>
  {@render children?.()}
</p>
