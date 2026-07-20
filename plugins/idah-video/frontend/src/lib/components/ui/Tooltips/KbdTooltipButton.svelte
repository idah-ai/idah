<script lang="ts">
  import type { Icon as IconType } from "@lucide/svelte";

  import TooltipButton from "$lib/components/ui/Tooltips/TooltipButton.svelte";
  import KbdGroup from "$lib/components/ui/Kbd/KbdGroup.svelte";
  import Kbd from "$lib/components/ui/Kbd/Kbd.svelte";
  import type { ButtonProps } from "$lib/components/ui/Button/button-variants";

  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";
  import { getDriver } from "$lib/state/driver.svelte";

  // Props
  interface Props extends ButtonProps {
    label: string;
    commandName?: string;
    icon?: typeof IconType;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
    onOpenChange?: (open: boolean) => void;
  }

  let {
    label,
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
    const raw = getDriver().command.getShortcut(commandName);
    return raw ? getShortcutLabel(raw) : undefined;
  });
</script>

<TooltipButton {...buttonProps} {icon} {children} {align} {side} {delayDuration} {onOpenChange}>
  {#snippet content()}
    <div class="flex items-center gap-4">
      <span>{label}</span>

      {#if shortcut}
        <KbdGroup>
          <Kbd class="border">{shortcut}</Kbd>
        </KbdGroup>
      {/if}
    </div>
  {/snippet}
</TooltipButton>
