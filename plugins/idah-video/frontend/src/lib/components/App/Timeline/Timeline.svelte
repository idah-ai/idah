<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import Caret from "$lib/components/App/Timeline/_Caret.svelte";
  import Ruler from "$lib/components/App/Timeline/_Ruler.svelte";
  import Selection from "$lib/components/App/Timeline/_Selection.svelte";
  import Track from "$lib/components/App/Timeline/_Track.svelte";
  import TrackInfo from "$lib/components/App/Timeline/_TrackInfo.svelte";

  import { selection } from "$lib/state/selection.svelte";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";

  import type { TimelineProps, Viewport } from "$lib/components/App/Timeline/types";

  interface Props extends TimelineProps {
    toolbar?: Snippet;
    remainingHeight: number;
    currentFrame?: number;
    onViewportChange?: (viewport: Viewport, zoomLevel: number) => void;
    onselectionchange?: (offset: number, length: number) => void;
    onDimensionsChange?: (width: number, height: number) => void;
    /** Register a zoom function for external callers (e.g. TimelineZoom). */
    onZoom?: (zoomFn: (newZoom: number) => void) => void;
  }

  let {
    viewport = $bindable(),
    items,
    length,
    rulerSmallStep = 10,
    rulerBigStep = 50,
    rulerLabelFormatter,
    toolbar,
    remainingHeight,
    currentFrame = $bindable(0),
    onViewportChange,
    onselectionchange,
    onDimensionsChange,
    onZoom,

    TrackInfoHeaderSlot,
    TrackInfoSlot,
  }: Props = $props();

  // Selection state (selectionLength is always 1 — single frame)
  let selectionLength = $state(1);
  let hasSelection = $state(false);

  // Derive selectionOffset from currentFrame
  const selectionOffset = $derived(currentFrame);

  let selectedGroupId = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" ? v.groupId : undefined;
  });

  // Bind to actual container pixel width
  let containerWidth = $state(0);

  // Scale: pixels per one unit of the timeline
  // The viewport range always fills the whole container
  const viewportRange = $derived(viewport.endRange - viewport.startRange);
  const scale = $derived(containerWidth > 0 ? containerWidth / viewportRange : 1);

  // Total content pixel width
  const contentWidth = $derived(length * scale);

  // Derive zoom level from viewport range
  const zoomLevel = $derived(length / viewportRange);

  onMount(() => {
    // Sync containerWidth and notify parent on resize (no $effect)
    function onResize() {
      if (!tracksViewportEl) return;
      const w = tracksViewportEl.clientWidth;
      if (w !== containerWidth) {
        containerWidth = w;
        if (onDimensionsChange && w > 0 && remainingHeight > 0) {
          onDimensionsChange(w, remainingHeight);
        }
      }
    }

    onResize();
    const ro = new ResizeObserver(onResize);
    if (tracksViewportEl) ro.observe(tracksViewportEl);

    return () => ro.disconnect();
  });

  // Helpers: convert between mouse x (content-space) and frame value
  function applyZoom(newZoom: number) {
    const newRange = length / newZoom;

    // Zoom from the center of the current viewport
    const center = (viewport.startRange + viewport.endRange) / 2;

    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;

    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > length) {
      newEnd = length;
      newStart = length - newRange;
    }

    viewport.startRange = newStart;
    viewport.endRange = newEnd;
    clampViewport();

    // Sync DOM scroll positions immediately after viewport change
    setScrollLeft(viewport.startRange * scale);
  }

  // Expose zoom function to parent on mount
  onMount(() => {
    onZoom?.(applyZoom);
  });

  function mouseXToFrame(mouseXInContent: number): number {
    return Math.floor(mouseXInContent / scale);
  }

  function frameToPixelX(frame: number): number {
    return frame * scale;
  }

  // Inline clamp helper — call at every mutation site instead of relying on an $effect
  // that writes to the same bindable state it depends on (which creates reactivity cycles).
  function clampViewport() {
    const sw = viewport.endRange - viewport.startRange;
    if (sw <= 0) return;
    let clamped = false;
    let ns = viewport.startRange;
    let ne = viewport.endRange;
    if (sw >= length) {
      ns = 0; ne = length; clamped = true;
    } else if (ns < 0) {
      ns = 0; ne = sw; clamped = true;
    } else if (ne > length) {
      ne = length; ns = length - sw; clamped = true;
    }
    if (clamped) {
      viewport.startRange = ns;
      viewport.endRange = ne;
    }
  }

  // Caret state
  // The frame under the cursor is stored directly (not derived from scale) so that
  // it stays frozen during zoom — only updated on actual mouse move.
  let showCaret = $state(false);
  let hoveredFrame = $state(0);
  const caretFrame = $derived(hoveredFrame);
  const caretPixelX = $derived(hoveredFrame * scale);

  let rulerViewportEl = $state<HTMLDivElement | null>(null);
  let tracksViewportEl = $state<HTMLDivElement | null>(null);
  let hScrollbarEl = $state<HTMLDivElement | null>(null);

  // Track in-flight programmatic scrolls per element to prevent feedback loops.
  // Using a Set so ruler, tracks and hscrollbar can all be pending simultaneously.
  const pendingProgrammatic = new Set<"ruler" | "tracks" | "hscrollbar">();

  // Set scrollLeft on all viewport elements (except the one that triggered the event).
  // Both syncScrollLeft and setScrollLeft are called synchronously at mutation sites
  // instead of relying on a reactive $effect (which would fire on every zoom event
  // and thrash layout by setting 3× scrollLeft per wheel tick).
  function setScrollLeft(targetScrollLeft: number, skip: "ruler" | "tracks" | "hscrollbar" | null = null) {
    if (skip !== "ruler" && rulerViewportEl && Math.abs(rulerViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("ruler");
      rulerViewportEl.scrollLeft = targetScrollLeft;
    }
    if (skip !== "tracks" && tracksViewportEl && Math.abs(tracksViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("tracks");
      tracksViewportEl.scrollLeft = targetScrollLeft;
    }
    if (skip !== "hscrollbar" && hScrollbarEl && Math.abs(hScrollbarEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("hscrollbar");
      hScrollbarEl.scrollLeft = targetScrollLeft;
    }
  }

  function syncScrollLeft(newScrollLeft: number, skip: "ruler" | "tracks" | "hscrollbar") {
    const rangeWidth = viewport.endRange - viewport.startRange;
    // Clamp startRange so the viewport stays within [0, length] without changing rangeWidth
    const clampedStartRange = Math.max(0, Math.min(newScrollLeft / scale, length - rangeWidth));
    viewport.startRange = clampedStartRange;
    viewport.endRange = clampedStartRange + rangeWidth;

    clampViewport();

    setScrollLeft(viewport.startRange * scale, skip);
  }

  function handleRulerScroll() {
    if (pendingProgrammatic.has("ruler")) {
      pendingProgrammatic.delete("ruler");
      return;
    }
    if (!rulerViewportEl || scale <= 0) return;
    syncScrollLeft(rulerViewportEl.scrollLeft, "ruler");
  }

  // Track last known scrollLeft to skip pure vertical scroll events
  let lastTracksScrollLeft = 0;

  function handleTracksScroll() {
    if (pendingProgrammatic.has("tracks")) {
      pendingProgrammatic.delete("tracks");
      return;
    }
    if (!tracksViewportEl || scale <= 0) return;
    // Ignore events that didn't change horizontal position (vertical scroll)
    if (tracksViewportEl.scrollLeft === lastTracksScrollLeft) return;
    lastTracksScrollLeft = tracksViewportEl.scrollLeft;
    syncScrollLeft(tracksViewportEl.scrollLeft, "tracks");
  }

  function handleHScrollbarScroll() {
    if (pendingProgrammatic.has("hscrollbar")) {
      pendingProgrammatic.delete("hscrollbar");
      return;
    }
    if (!hScrollbarEl || scale <= 0) return;
    syncScrollLeft(hScrollbarEl.scrollLeft, "hscrollbar");
  }

  // Handle wheel on the ruler: non-Ctrl → horizontal pan, Ctrl → zoom
  function handleRulerWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey) {
      handleWheel(e);
      return;
    }
    if (scale <= 0) return;
    // Use whichever axis has the larger delta (supports both wheel mice and trackpads)
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    // Use viewport.startRange * scale as the current position — it's updated synchronously
    // by syncScrollLeft, unlike rulerViewportEl.scrollLeft which lags behind the effect.
    const currentScrollLeft = viewport.startRange * scale;
    const newScrollLeft = Math.max(0, currentScrollLeft + delta);
    syncScrollLeft(newScrollLeft, "ruler");
  }

  // Handle Ctrl+scroll zoom
  function handleWheel(e: WheelEvent) {
    if (!e.metaKey || scale <= 0) return;

    e.preventDefault();

    // Use tracks viewport for wheel events
    const el = tracksViewportEl || rulerViewportEl;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const mouseXInViewport = e.clientX - rect.left;
    const mouseXInContent = mouseXInViewport + el.scrollLeft;

    // Convert mouse position to timeline range value
    const mouseRangeValue = mouseXInContent / scale;
    const currentRangeWidth = viewport.endRange - viewport.startRange;

    // Calculate zoom factor (zoom in = smaller range, zoom out = larger range)
    // Use a constant factor for smooth zooming
    const ZOOM_SENSITIVITY = 0.1;
    const zoomFactor = 1 - Math.sign(e.deltaY) * ZOOM_SENSITIVITY;

    // Calculate new range width, clamped to reasonable bounds
    const newRangeWidth = Math.max(1, currentRangeWidth * zoomFactor);

    // Calculate the mouse position as a ratio within the current range
    const mouseRatio = (mouseRangeValue - viewport.startRange) / currentRangeWidth;

    // Calculate new start/end range values
    // This keeps the mouse pointing at the same timeline point after zoom
    let newStartRange = mouseRangeValue - mouseRatio * newRangeWidth;
    let newEndRange = newStartRange + newRangeWidth;

    // Clamp to valid bounds (0 to length)
    if (newStartRange < 0) {
      newStartRange = 0;
      newEndRange = newRangeWidth;
    }
    if (newEndRange > length) {
      newEndRange = length;
      newStartRange = length - newRangeWidth;
    }

    // Update viewport values
    viewport.startRange = newStartRange;
    viewport.endRange = newEndRange;

    clampViewport();

    // Sync scrollLeft synchronously in the wheel handler instead of waiting for a reactive effect
    setScrollLeft(viewport.startRange * scale);
  }

  // Compute content-space x from a mouse event relative to a given scrollable element
  function contentXFromEvent(e: MouseEvent, el: HTMLDivElement): number {
    const rect = el.getBoundingClientRect();
    return e.clientX - rect.left + el.scrollLeft;
  }

  // Handle mouse move for caret (works for both ruler and tracks viewport)
  // The frame is computed eagerly and stored so it stays fixed during zoom.
  function handleMouseMove(e: MouseEvent) {
    const el = tracksViewportEl ?? rulerViewportEl;
    if (!el || scale <= 0) return;
    const mouseX = contentXFromEvent(e, el);
    hoveredFrame = Math.floor(mouseX / scale);
    showCaret = true;
  }

  function handleRulerMouseMove(e: MouseEvent) {
    if (!rulerViewportEl || scale <= 0) return;
    const mouseX = contentXFromEvent(e, rulerViewportEl);
    hoveredFrame = Math.floor(mouseX / scale);
    showCaret = true;
  }

  function handleMouseLeave() {
    showCaret = false;
  }

  // Common click-to-select logic
  function applyClickSelect(mouseXInContent: number) {
    const clickValue = mouseXToFrame(mouseXInContent);
    currentFrame = clickValue;
    selectionLength = 1;
    hasSelection = true;
    if (onselectionchange) {
      onselectionchange(currentFrame, selectionLength);
    }
  }

  // Handle click to set selection (tracks viewport)
  function handleClick(e: MouseEvent) {
    if (!tracksViewportEl || scale <= 0) return;
    applyClickSelect(contentXFromEvent(e, tracksViewportEl));
  }

  // Handle click to set selection (ruler viewport)
  function handleRulerClick(e: MouseEvent) {
    if (!rulerViewportEl || scale <= 0) return;
    applyClickSelect(contentXFromEvent(e, rulerViewportEl));
  }

  // Viewport-relative x positions for caret labels (so they don't need to scroll)
  const selectionCaretViewportX = $derived((selectionOffset - viewport.startRange) * scale);
  const hoverCaretViewportX = $derived(caretPixelX - viewport.startRange * scale);

  // Vertical virtualization: track the body-scroll element's scroll position
  let bodyScrollEl = $state<HTMLDivElement | null>(null);
  let bodyScrollTop = $state(0);
  let bodyScrollClientHeight = $state(0);

  function handleBodyScroll() {
    if (!bodyScrollEl) return;
    bodyScrollTop = bodyScrollEl.scrollTop;
  }

  // Calculate tracks height for content
  const tracksHeight = $derived(items.length * TRACK_HEIGHT);

  // Derive which tracks are vertically visible (with one track of overdraw on each side)
  const firstVisibleTrackIndex = $derived(Math.max(0, Math.floor(bodyScrollTop / TRACK_HEIGHT) - 1));
  const lastVisibleTrackIndex = $derived(
    Math.min(items.length - 1, Math.ceil((bodyScrollTop + bodyScrollClientHeight) / TRACK_HEIGHT)),
  );
  const visibleTracks = $derived(
    items.slice(firstVisibleTrackIndex, lastVisibleTrackIndex + 1).map((track, i) => ({
      ...track,
      top: (firstVisibleTrackIndex + i) * TRACK_HEIGHT,
    })),
  );
</script>

<div class="timeline" style:height="{Math.max(remainingHeight, TRACK_HEIGHT)}px">
  {#if toolbar}
    <div class="timeline-toolbar">
      {@render toolbar()}
    </div>
  {/if}

  <div class="timeline-ruler-wrapper">
    <div class="timeline-ruler-spacer" aria-hidden="true">
      {#if TrackInfoHeaderSlot}
        {@render TrackInfoHeaderSlot()}
      {/if}
    </div>

    <div
      role="button"
      tabindex="0"
      class="timeline-ruler-viewport"
      bind:this={rulerViewportEl}
      onscroll={handleRulerScroll}
      onwheel={handleRulerWheel}
      onmousemove={handleRulerMouseMove}
      onmouseleave={handleMouseLeave}
      onkeypress={() => {}}
      onclick={handleRulerClick}
    >
      <Ruler
        {viewport}
        {scale}
        smallStep={rulerSmallStep}
        bigStep={rulerBigStep}
        labelFormatter={rulerLabelFormatter}
      />
    </div>
    <!-- Non-scrolling overlay for caret labels — uses viewport-relative x so labels track correctly -->
    <div class="timeline-ruler-caret-overlay" aria-hidden="true">
      {#if hasSelection && selectionOffset >= 0 && selectionOffset < length && selectionCaretViewportX >= 0 && selectionCaretViewportX <= containerWidth}
        <Caret
          x={selectionCaretViewportX}
          value={selectionOffset}
          labelFormatter={rulerLabelFormatter}
          height={30}
          color="#4a90d9"
          showLine={false}
        />
      {/if}
      {#if showCaret && hoverCaretViewportX >= 0 && hoverCaretViewportX <= containerWidth}
        <Caret
          x={hoverCaretViewportX}
          value={caretFrame}
          labelFormatter={rulerLabelFormatter}
          height={30}
          color="orangered"
          showLine={false}
        />
      {/if}
    </div>
  </div>

  <!-- Vertical scroll container: scrolls both trackinfos and tracks together -->
  <div
    class="timeline-body-scroll"
    bind:this={bodyScrollEl}
    bind:clientHeight={bodyScrollClientHeight}
    onscroll={handleBodyScroll}
  >
    <div class="timeline-main">
      <div class="timeline-trackinfos-body" onwheel={handleBodyScroll} style="height: {tracksHeight}px;">
        {#each visibleTracks as track (track.id)}
          {#if TrackInfoSlot}
            {@render TrackInfoSlot({ track })}
          {:else}
            <TrackInfo {track} />
          {/if}
        {/each}
      </div>

      <div
        role="button"
        tabindex="0"
        class="timeline-tracks-viewport focus:outline-none"
        bind:this={tracksViewportEl}
        onscroll={handleTracksScroll}
        onwheel={handleWheel}
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
        onclick={handleClick}
        onkeypress={() => {}}
      >
        <div class="timeline-tracks-content" style="width: {contentWidth}px; height: {tracksHeight}px;">
          {#if hasSelection && selectionOffset >= 0 && selectionOffset < length}
            <Selection
              offset={selectionOffset}
              length={selectionLength}
              {scale}
              height={tracksHeight}
              trackLength={length}
            />
            <Caret
              x={selectionOffset * scale}
              value={selectionOffset}
              labelFormatter={rulerLabelFormatter}
              height={tracksHeight}
              color="#4a90d9"
              showLabel={false}
            />
          {/if}
          {#each visibleTracks as track (track.id)}
            <Track
              {viewport}
              {scale}
              items={track.items}
              top={track.top}
              isSelected={selectedGroupId === track.id}
            />
          {/each}
          {#if showCaret && caretPixelX >= 0 && caretPixelX <= contentWidth}
            <Selection
              offset={caretFrame}
              length={1}
              {scale}
              height={tracksHeight}
              trackLength={length}
              color="orangered"
            />
            <Caret
              x={caretPixelX}
              value={caretFrame}
              labelFormatter={rulerLabelFormatter}
              height={tracksHeight}
              color="orangered"
              showLabel={false}
            />
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Custom horizontal scrollbar pinned at the bottom of .timeline,
	     outside .timeline-body-scroll so it is always visible regardless of vertical scroll -->
  <div class="timeline-hscrollbar-wrapper">
    <div class="timeline-hscrollbar-spacer" aria-hidden="true"></div>
    <div class="timeline-hscrollbar" bind:this={hScrollbarEl} onscroll={handleHScrollbarScroll}>
      <div style="width: {contentWidth}px; height: 1px;" aria-hidden="true"></div>
    </div>
  </div>
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    border: 1px solid #ccc;
  }

  .timeline-toolbar {
    flex-shrink: 0;
  }

  .timeline-ruler-wrapper {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  .timeline-ruler-spacer {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid #ccc;
    background-color: #fafafa;
  }

  .timeline-ruler-viewport {
    position: relative;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: none; /* Hide scrollbar but keep functionality */
    cursor: crosshair;
  }

  .timeline-ruler-viewport::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* Absolutely-positioned overlay aligned with the ruler viewport area.
	   Caret labels are rendered here at viewport-relative x so they follow scroll correctly. */
  .timeline-ruler-caret-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 300px; /* same width as .timeline-ruler-spacer */
    right: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 10;
  }

  /* Vertical scroll container: takes remaining height, scrolls trackinfos + tracks together */
  .timeline-body-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .timeline-main {
    display: flex;
  }

  .timeline-trackinfos-body {
    position: relative;
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid #ccc;
  }

  /* Horizontal-only scroll viewport for the tracks area.
	   Native scrollbar is hidden — the custom hscrollbar below is used instead. */
  .timeline-tracks-viewport {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .timeline-tracks-viewport::-webkit-scrollbar {
    display: none;
  }

  .timeline-tracks-content {
    position: relative;
  }

  /* Always-visible horizontal scrollbar, pinned at the bottom of .timeline */
  .timeline-hscrollbar-wrapper {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid #eee;
  }

  .timeline-hscrollbar-spacer {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid #ccc;
    background-color: #fafafa;
  }

  .timeline-hscrollbar {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
  }
</style>
