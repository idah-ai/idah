<script lang="ts" module>
  import Spinner from "$lib/components/ui/Spinner/Spinner.svelte";

  import { cn } from "$lib/utils.js";
  import {
    buttonVariants,
    type ButtonVariant,
    type ButtonSize,
    type ButtonProps,
  } from "$lib/components/ui/Button/button-variants";

  export { buttonVariants, type ButtonVariant, type ButtonSize, type ButtonProps };
</script>

<script lang="ts">
  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    loading,
    loadingLabel = "Loading",
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled || loading}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {#if loading}
      <Spinner size="sm" variant={variant === "default" ? "primary-foreground" : "default"}></Spinner>
      {loadingLabel}
    {:else}
      {@render children?.()}
    {/if}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    disabled={disabled || loading}
    {...restProps}
  >
    {#if loading}
      <Spinner size="sm" variant={variant === "default" ? "primary-foreground" : "default"}></Spinner>
      {loadingLabel}
    {:else}
      {@render children?.()}
    {/if}
  </button>
{/if}
