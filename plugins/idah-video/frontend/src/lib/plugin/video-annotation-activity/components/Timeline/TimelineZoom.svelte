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

  // Local slider state — decoupled from the prop to prevent
  // two-way binding cycles (prop update → slider update → onValueChange → applyZoom → prop update).
  // Synced from the prop only when it changes externally (e.g., wheel zoom from the timeline).
  let localZoom = $state(displayZoomLevel);

  $effect(() => {
    if (Math.abs(localZoom - displayZoomLevel) > 0.001) {
      localZoom = displayZoomLevel;
    }
  });

  function handleSliderChange(value: number) {
    localZoom = value;
    if (Math.abs(value - displayZoomLevel) > 0.001) {
      applyZoom(value);
    }
  }

  function zoomOut() {
    const newZoom = Math.max(Math.round((localZoom - ZOOM_STEP) * 10) / 10, zoomMin);
    localZoom = newZoom;
    applyZoom(newZoom);
  }

  function zoomIn() {
    const newZoom = Math.min(Math.round((localZoom + ZOOM_STEP) * 10) / 10, zoomMax);
    localZoom = newZoom;
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

  <Slider type="single" class="w-40" min={zoomMin} max={zoomMax} step={0.1} value={localZoom} onValueChange={handleSliderChange} />

  <ToolTooltip label="Zoom In" shortcut={getShortcut(context.shortcutReferences?.["timeline.zoom_in"].keyCombinations)}>
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomIn}>
        <ZoomInIcon />
      </Button>
    {/snippet}
  </ToolTooltip>
</div>
