<script lang="ts">
  import type { Snippet } from "svelte";

  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  // Props
  interface Props {
    delayDuration?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    ignoreNonKeyboardFocus?: boolean;
    trigger: Snippet;
    content: Snippet;
  }
  let {
    delayDuration = 200,
    align = "start",
    side = undefined,
    ignoreNonKeyboardFocus = false,
    trigger,
    content,
  }: Props = $props();
</script>

<TooltipProvider {ignoreNonKeyboardFocus}>
  <Tooltip {delayDuration}>
    <TooltipTrigger>
      {@render trigger()}
    </TooltipTrigger>

    <TooltipContent {align} {side}>
      {@render content()}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
