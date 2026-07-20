<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  import type { ButtonProps } from "$lib/components/ui/button/button.svelte";
  import type { TooltipPositionProps } from "$lib/components/app/tooltips/tooltips.svelte";

  // Props
  interface Props extends ButtonProps, TooltipPositionProps {
    content: Snippet;
    icon?: Component;
  }

  let {
    content,
    icon: Icon,
    children,
    align = "center",
    side = "top",
    delayDuration = 200,
    onOpenChange,
    ...buttonProps
  }: Props = $props();
</script>

<Tooltips {align} {side} {delayDuration} {onOpenChange} {content}>
  {#snippet trigger()}
    <Button {...buttonProps}>
      {#if children}
        {@render children()}
      {:else if Icon}
        <Icon />
      {/if}
    </Button>
  {/snippet}
</Tooltips>
