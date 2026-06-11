<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";

  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import { cn } from "$lib/utils";

  // Props
  interface Props {
    class?: string | null;
    label: string;
    icon?: typeof IconType;
    disabled?: boolean;
    onclick: (e: MouseEvent) => void;
  }
  let { class: className, label, disabled, icon: Icon, onclick }: Props = $props();
</script>

<ToolTooltip {label}>
  {#snippet trigger()}
    <Button
      variant="ghost"
      size="icon-sm"
      class={cn("text-muted-foreground shrink-0", className)}
      {disabled}
      onclick={(e) => {
        e.stopPropagation();
        onclick(e);
      }}
    >
      <Icon />
    </Button>
  {/snippet}
</ToolTooltip>
