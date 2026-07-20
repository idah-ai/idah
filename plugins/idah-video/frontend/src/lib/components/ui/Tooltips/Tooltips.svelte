<script lang="ts" module>
  export interface TooltipPositionProps {
    delayDuration?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    onOpenChange?: (open: boolean) => void;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "$lib/components/ui/Tooltip";

  import { cn } from "$lib/utils";

  // Props
  interface Props extends TooltipPositionProps {
    ignoreNonKeyboardFocus?: boolean;
    class?: string | null;
    trigger: Snippet;
    content: Snippet;
  }
  let {
    delayDuration = 200,
    align = "start",
    side = undefined,
    ignoreNonKeyboardFocus = false,
    onOpenChange,
    class: className,
    trigger,
    content,
  }: Props = $props();
</script>

<TooltipProvider {ignoreNonKeyboardFocus}>
  <Tooltip {delayDuration} {ignoreNonKeyboardFocus} {onOpenChange}>
    <TooltipTrigger class={cn("", className)}>
      {@render trigger()}
    </TooltipTrigger>

    <TooltipContent {align} {side}>
      {@render content()}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
