<script lang="ts">
  import type { Snippet } from "svelte";

  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import KbdGroup from "$lib/components/ui/Kbd/KbdGroup.svelte";
  import Kbd from "$lib/components/ui/Kbd/Kbd.svelte";

  // Props
  interface Props {
    label: string;
    shortcut?: string | null;
    trigger: Snippet;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
    onOpenChange?: (open: boolean) => void;
  }

  let {
    label,
    shortcut,
    trigger: triggerSnippet,
    align = "center",
    side = "top",
    delayDuration = 200,
    onOpenChange,
  }: Props = $props();
</script>

<Tooltips {align} {side} {delayDuration} trigger={triggerSnippet} {onOpenChange}>
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
</Tooltips>
