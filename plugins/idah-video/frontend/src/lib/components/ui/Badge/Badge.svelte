<script lang="ts" module>
  import {
    badgeVariants,
    type BadgeVariant,
    type BadgeRounded,
  } from "$lib/components/ui/Badge/badge-variants";

  export { badgeVariants, type BadgeVariant, type BadgeRounded };
</script>

<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    href,
    class: className,
    variant = "default",
    rounded = "default",
    children,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    variant?: BadgeVariant;
    rounded?: BadgeRounded;
  } = $props();
</script>

<svelte:element
  this={href ? "a" : "span"}
  bind:this={ref}
  data-slot="badge"
  {href}
  class={cn(badgeVariants({ variant, rounded }), className)}
  {...restProps}
>
  {@render children?.()}
</svelte:element>
