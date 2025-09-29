<script lang="ts">
  import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    delayDuration?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet;
    content: Snippet;
  }
  let { delayDuration = 200, align = "start", side = undefined, trigger, content }: Props = $props();
</script>

<Tooltip {delayDuration}>
  <TooltipTrigger>
    {@render trigger()}
  </TooltipTrigger>

  <TooltipContent {align} {side}>
    {@render content()}
  </TooltipContent>
</Tooltip>
