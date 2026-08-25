<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";

  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import Slider from "$lib/components/ui/Slider/Slider.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { claimDriverShortcut } from "$lib/state/driver.svelte";

  // Props
  interface Props {
    zoomFn: ((zoom: number, center?: number) => void) | undefined;
  }
  let { zoomFn }: Props = $props();

  // Constants — multiplicative factor for 10% zoom steps
  const ZOOM_FACTOR = 1.1;

  // --- Everything derived from global state ---
  // No local state, no $effect — the slider reads from the global viewport reactively.

  const totalFrames = $derived(media.totalFrames > 0 ? media.totalFrames : 1);
  const containerWidth = $derived(viewport.timeline.dimensions[0]);
  const rangeWidth = $derived(viewport.timeline.range.endRange - viewport.timeline.range.startRange);

  /** Current zoom level: total-frames / visible-range. */
  const currentZoom = $derived(totalFrames / (rangeWidth > 0 ? rangeWidth : 1));

  /** Min zoom = show the entire video. */
  const zoomMin = 1;

  /** Max zoom = 80px per frame. */
  const zoomMax = $derived(containerWidth > 0 ? Math.max(zoomMin, (totalFrames * 80) / containerWidth) : zoomMin);

  // Round to step precision (0.1) so bits-ui never sees an off-step value and
  // fires an internal snap that re-triggers onValueChange after zoom.
  const SLIDER_STEP = 0.1;
  const sliderValue = $derived(
    Math.round(Math.max(zoomMin, Math.min(zoomMax, currentZoom)) / SLIDER_STEP) * SLIDER_STEP,
  );

  // --- Actions ---

  function zoomOut() {
    const newZoom = Math.max(Math.round((sliderValue / ZOOM_FACTOR) * 10) / 10, zoomMin);
    zoomFn?.(newZoom, viewport.video.currentFrame.value);
  }

  function zoomIn() {
    const newZoom = Math.min(Math.round(sliderValue * ZOOM_FACTOR * 10) / 10, zoomMax);
    zoomFn?.(newZoom, viewport.video.currentFrame.value);
  }

  // guards against bits-ui's spurious onValueChange fires by skipping values within half a step (0.05) of current,
  function handleSliderZoom(v: number) {
    if (Math.abs(v - sliderValue) < SLIDER_STEP / 2) return;
    zoomFn?.(v, viewport.video.currentFrame.value);
  }

</script>

<!-- onkeydowncapture: the bits-ui zoom slider handles arrow keys natively
     (Cmd+Arrow jumps it to min/max), which collides with frame-navigation
     shortcuts. Let the driver claim its shortcuts before the slider sees them. -->
<div id="timeline-controller" class="flex items-center gap-2" onkeydowncapture={claimDriverShortcut}>
  <KbdTooltipButton label="Zoom Out" commandName="timeline.zoom_out" icon={ZoomOutIcon} variant="outline" size="icon-sm" onclick={zoomOut} />

  <Slider
    type="single"
    class="w-40"
    min={zoomMin}
    max={zoomMax}
    step={SLIDER_STEP}
    value={sliderValue}
    onValueChange={handleSliderZoom}
  />

  <KbdTooltipButton label="Zoom In" commandName="timeline.zoom_in" icon={ZoomInIcon} variant="outline" size="icon-sm" onclick={zoomIn} />
</div>
