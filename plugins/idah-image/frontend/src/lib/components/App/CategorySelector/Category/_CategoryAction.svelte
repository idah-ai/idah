<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";

  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import { cn } from "$lib/utils";

  // Props
  interface Props {
    class?: string | null;
    onclick: (e: MouseEvent) => void;
    label: string;
    disabled?: boolean;
    icon?: typeof IconType;
  }
  let { class: className, onclick, icon, label, disabled }: Props = $props();
</script>

<KbdTooltipButton
  {label}
  {icon}
  variant="ghost"
  size="icon-sm"
  class={cn("text-muted-foreground shrink-0", className)}
  {disabled}
  onclick={(e) => {
    e.stopPropagation();
    onclick(e);
  }}
/>
