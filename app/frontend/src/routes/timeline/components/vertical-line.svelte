<script lang="ts">
  import { cn } from "@/utils";

  import { getFrameFromMouseX } from "./utils";

  // Props
  interface Props {
    positionX: number;
    timelineRowHeaderWidth: number;
    timelineCellWidth: number;
    color?: "default" | "primary";
  }
  let { positionX, timelineRowHeaderWidth, timelineCellWidth, color = "default" }: Props = $props();

  // Variables
  let frame = $derived(getFrameFromMouseX({ clientX: positionX, timelineRowHeaderWidth, timelineCellWidth }));

  let colorClass = $derived.by(() => {
    switch (color) {
      case "primary": {
        return "bg-primary text-primary-foreground";
      }
      default: {
        return "bg-foreground text-background";
      }
    }
  });
</script>

<!-- HIGHLIGHTED FRAME LABEL -->
<div
  class={cn(
    "pointer-events-none absolute top-[9px] z-50 min-w-6 -translate-x-1/2 rounded-sm px-2 py-1 text-center text-xs font-medium",
    colorClass,
  )}
  style="transform: translateX({positionX}px)"
>
  {frame}

  <div class={cn("absolute top-full left-1/2 -mt-1 size-1.5 -translate-x-1/2 rotate-45", colorClass)}></div>
</div>

<!-- VERTICAL LINE -->
<div class={cn("cursor-line", colorClass)} style="transform: translateX({positionX}px)"></div>

<style>
  .cursor-line {
    position: absolute;
    top: 9px;
    bottom: 0;
    width: 2px;
    pointer-events: none;
  }
</style>
