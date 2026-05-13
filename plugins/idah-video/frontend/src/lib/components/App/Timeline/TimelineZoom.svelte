<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import { getShortcut } from "$lib/components/ui/Kbd/utils";

  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Slider from "$lib/components/ui/Slider/Slider.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";

  // Props
  interface Props {
    zoomFn: ((zoom: number) => void) | undefined;
  }
  let { zoomFn }: Props = $props();

  // Constants
  const ZOOM_STEP = 0.1;

  // --- Everything derived from global state ---
  // No local state, no $effect — the slider reads from the global viewport reactively.

  const totalFrames = $derived(media.totalFrames > 0 ? media.totalFrames : 1);
  const containerWidth = $derived(viewport.timeline.dimensions[0]);
  const rangeWidth = $derived(
    viewport.timeline.range.endRange - viewport.timeline.range.startRange,
  );

  /** Current zoom level: total-frames / visible-range. */
  const currentZoom = $derived(totalFrames / (rangeWidth > 0 ? rangeWidth : 1));

  /** Min zoom = show the entire video. */
  const zoomMin = 1;

  /** Max zoom = 80px per frame. */
  const zoomMax = $derived(
    containerWidth > 0
      ? Math.max(zoomMin, (totalFrames * 80) / containerWidth)
      : zoomMin,
  );

  /** Clamped display value for the slider. */
  const displayZoom = $derived(
    Math.max(zoomMin, Math.min(zoomMax, currentZoom)),
  );

  const sliderValue = $derived(Math.max(zoomMin, Math.min(zoomMax, currentZoom)));

  // --- Actions ---

  function zoomOut() {
    const newZoom = Math.max(
      Math.round((displayZoom - ZOOM_STEP) * 10) / 10,
      zoomMin,
    );
    zoomFn?.(newZoom);
  }

  function zoomIn() {
    const newZoom = Math.min(
      Math.round((displayZoom + ZOOM_STEP) * 10) / 10,
      zoomMax,
    );
    zoomFn?.(newZoom);
  }
</script>

<div id="timeline-controller" class="flex items-center gap-2">
  <ToolTooltip
    label="Zoom Out"
    shortcut={getShortcut(getDriver().command.getShortcutReferences()?.["timeline.zoom_out"]?.keyCombinations)}
  >
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomOut}>
        <ZoomOutIcon />
      </Button>
    {/snippet}
  </ToolTooltip>

  <Slider
    type="single"
    class="w-40"
    min={0}
    max={100}
    step={0.1}
    value={sliderValue}
    onValueChange={(v) => zoomFn?.(v)}
  />

  <ToolTooltip
    label="Zoom In"
    shortcut={getShortcut(getDriver().command.getShortcutReferences()?.["timeline.zoom_in"]?.keyCombinations)}
  >
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomIn}>
        <ZoomInIcon />
      </Button>
    {/snippet}
  </ToolTooltip>
</div>
