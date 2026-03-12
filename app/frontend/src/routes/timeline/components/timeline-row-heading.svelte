<script lang="ts">
  import { cn } from "@/utils";
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children?: Snippet;
    class?: string | null;
  }
  let { children, class: className }: Props = $props();
</script>

<p class={cn("font-regular truncate text-sm", className)}>
  {@render children?.()}
</p>
