<script lang="ts">
  import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    openDelay?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet;
    content: Snippet;
  }
  let { openDelay = 200, align = "start", side = undefined, trigger, content }: Props = $props();
</script>

<HoverCard {openDelay}>
  <HoverCardTrigger>
    {@render trigger()}
  </HoverCardTrigger>

  <HoverCardContent {align} {side}>
    {@render content()}
  </HoverCardContent>
</HoverCard>
