<script lang="ts">
  import type { Component } from "svelte";

  import TooltipButton from "$lib/components/app/tooltips/TooltipButton.svelte";
  import KbdGroup from "$lib/components/ui/kbd/kbd-group.svelte";
  import Kbd from "$lib/components/ui/kbd/kbd.svelte";

  import { getShortcutLabel } from "$lib/components/ui/kbd/utils";

  import type { ButtonProps } from "$lib/components/ui/button/button.svelte";
  import type { IIdahDriverV2 } from "$lib/plugin/v2/types";
  import type { TooltipPositionProps } from "$lib/components/app/tooltips/tooltips.svelte";

  // Props
  interface Props extends ButtonProps, TooltipPositionProps {
    label: string;
    driver: IIdahDriverV2;
    commandName?: string;
    icon?: Component;
  }

  let {
    label,
    driver,
    commandName,
    icon,
    children,
    align = "center",
    side = "top",
    delayDuration = 200,
    onOpenChange,
    ...buttonProps
  }: Props = $props();

  const shortcut = $derived.by(() => {
    if (!commandName) return undefined;
    const raw = driver.command.getShortcut(commandName);
    return raw ? getShortcutLabel(raw) : undefined;
  });
</script>

<TooltipButton {...buttonProps} {icon} {children} {align} {side} {delayDuration} {onOpenChange}>
  {#snippet content()}
    <div class="flex items-center gap-4">
      <span>{label}</span>

      {#if shortcut}
        <KbdGroup>
          <Kbd>{shortcut}</Kbd>
        </KbdGroup>
      {/if}
    </div>
  {/snippet}
</TooltipButton>
