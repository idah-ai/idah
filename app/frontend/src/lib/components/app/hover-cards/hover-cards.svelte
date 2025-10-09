<script lang="ts">
  import type { Snippet } from "svelte";

  import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
  import { cn } from "@/utils";

  // Props
  interface Props {
    contentClass?: string | null;
    openDelay?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet;
    content: Snippet;
  }
  let { contentClass, openDelay = 200, align = "start", side = undefined, trigger, content }: Props = $props();
</script>

<HoverCard {openDelay}>
  <HoverCardTrigger>
    {@render trigger()}
  </HoverCardTrigger>

  <HoverCardContent {align} {side} class={cn("", contentClass)}>
    {@render content()}
  </HoverCardContent>
</HoverCard>
