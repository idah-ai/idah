<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn } from "$lib/utils.js";

  // Props
  let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
  data-slot="empty-description"
  class={cn(
    "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
