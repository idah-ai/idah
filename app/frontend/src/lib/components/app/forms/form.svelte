<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLFormElement>>;
  let { ref, class: className, children }: Props = $props();
</script>

<form bind:this={ref} class={cn("grid gap-4 px-1", className)}>
  {@render children?.()}
</form>
