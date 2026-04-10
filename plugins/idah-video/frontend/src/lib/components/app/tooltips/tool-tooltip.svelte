<script lang="ts">
  import type { Snippet } from "svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import KbdGroup from "$lib/components/ui/kbd/kbd-group.svelte";
  import Kbd from "$lib/components/ui/kbd/kbd.svelte";

  // Props
  interface Props {
    label: string;
    shortcut?: string | null;
    trigger: Snippet;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
  }

  let {
    label,
    shortcut,
    trigger: triggerSnippet,
    align = "center",
    side = "top",
    delayDuration = 200,
  }: Props = $props();
</script>

<Tooltips {align} {side} {delayDuration} trigger={triggerSnippet}>
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
