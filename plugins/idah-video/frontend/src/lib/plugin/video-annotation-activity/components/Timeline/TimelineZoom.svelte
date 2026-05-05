<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import { getShortcut } from "$lib/components/ui/kbd/utils";

  import ToolTooltip from "$lib/components/app/tooltips/tool-tooltip.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Slider from "$lib/components/ui/slider/slider.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";

  // Props
  interface Props {
    displayZoomLevel: number;
    applyZoom: (zoom: number) => void;
    zoomMin: number;
    zoomMax: number;
  }
  let { displayZoomLevel, applyZoom, zoomMin, zoomMax }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Constants
  const ZOOM_STEP = 0.1;

  // Functions
  function zoomOut() {
    const newZoom = Math.max(Math.round((displayZoomLevel - ZOOM_STEP) * 10) / 10, zoomMin);
    applyZoom(newZoom);
  }

  function zoomIn() {
    const newZoom = Math.min(Math.round((displayZoomLevel + ZOOM_STEP) * 10) / 10, zoomMax);
    applyZoom(newZoom);
  }
</script>

<div id="timeline-controller" class="flex items-center gap-2">
  <ToolTooltip
    label="Zoom Out"
    shortcut={getShortcut(context.shortcutReferences?.["timeline.zoom_out"].keyCombinations)}
  >
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomOut}>
        <ZoomOutIcon />
      </Button>
    {/snippet}
  </ToolTooltip>

  <Slider type="single" class="w-40" min={zoomMin} max={zoomMax} step={0.1} value={displayZoomLevel} onValueChange={applyZoom} />

  <ToolTooltip label="Zoom In" shortcut={getShortcut(context.shortcutReferences?.["timeline.zoom_in"].keyCombinations)}>
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomIn}>
        <ZoomInIcon />
      </Button>
    {/snippet}
  </ToolTooltip>
</div>
