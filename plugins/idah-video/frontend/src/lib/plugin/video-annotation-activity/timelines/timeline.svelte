<script lang="ts">
  import type { Snippet } from "svelte";

  import Caret from "$lib/plugin/video-annotation-activity/timelines/caret.svelte";
  import Ruler from "$lib/plugin/video-annotation-activity/timelines/ruler.svelte";
  import Selection from "$lib/plugin/video-annotation-activity/timelines/selection.svelte";
  import TrackInfo from "$lib/plugin/video-annotation-activity/timelines/track-info.svelte";
  import Track from "$lib/plugin/video-annotation-activity/timelines/track.svelte";

  import type { TimelineProps, Viewport } from "$lib/plugin/video-annotation-activity/timelines/types";

  interface Props extends TimelineProps {
    toolbar?: Snippet;
    remainingHeight: number;
    oncontainerWidthChange?: (width: number) => void;
    onViewportChange?: (viewport: Viewport, zoomLevel: number) => void;
    onselectionchange?: (offset: number, length: number) => void;
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
    oncontainerWidthChange,
    onViewportChange,
    onselectionchange,
  }: Props = $props();

  // Selection state
  let selectionOffset = $state(0);
  let selectionLength = $state(1);
  let hasSelection = $state(false);

  // Emit containerWidth changes to parent
  $effect(() => {
    if (oncontainerWidthChange && containerWidth > 0) {
      oncontainerWidthChange(containerWidth);
    }
  });

  // Derive zoom level from viewport range
  const zoomLevel = $derived(length / (viewport.endRange - viewport.startRange));

  // Notify parent of viewport changes (including zoom level)
  $effect(() => {
    if (onViewportChange) {
      onViewportChange({ startRange: viewport.startRange, endRange: viewport.endRange }, zoomLevel);
    }
  });

  // Clamp viewport to valid bounds whenever it changes from any source.
  // Preserves range width when only translating; shrinks to [0, length] if range exceeds length.
  $effect(() => {
    const rangeWidth = viewport.endRange - viewport.startRange;
    if (rangeWidth <= 0) return;

    let newStart = viewport.startRange;
    let newEnd = viewport.endRange;

    if (rangeWidth >= length) {
      // Range wider than (or equal to) the entire content — show everything
      newStart = 0;
      newEnd = length;
    } else if (newStart < 0) {
      // Slide right to the start, keep width
      newStart = 0;
      newEnd = rangeWidth;
    } else if (newEnd > length) {
      // Slide left to the end, keep width
      newEnd = length;
      newStart = length - rangeWidth;
    }

    if (newStart !== viewport.startRange) viewport.startRange = newStart;
    if (newEnd !== viewport.endRange) viewport.endRange = newEnd;
  });

  // Group items by trackId to get unique tracks
  const tracks = $derived(
    [...new Set(items.map((item) => item.trackId))].map((trackId) => ({
      id: trackId,
      items: items.filter((item) => item.trackId === trackId),
    })),
  );

  // Bind to actual container pixel width
  let containerWidth = $state(0);

  // Scale: pixels per one unit of the timeline
  // The viewport range always fills the whole container
  const viewportRange = $derived(viewport.endRange - viewport.startRange);
  const scale = $derived(containerWidth > 0 ? containerWidth / viewportRange : 1);

  // Total content pixel width
  const contentWidth = $derived(length * scale);

  // Caret state
  let showCaret = $state(false);
  let caretX = $state(0);
  let caretValue = $state(0);
  let lastMouseX = $state(0);

  let rulerViewportEl = $state<HTMLDivElement | null>(null);
  let tracksViewportEl = $state<HTMLDivElement | null>(null);
  let hScrollbarEl = $state<HTMLDivElement | null>(null);

  // Track in-flight programmatic scrolls per element to prevent feedback loops.
  // Using a Set so ruler, tracks and hscrollbar can all be pending simultaneously.
  const pendingProgrammatic = new Set<"ruler" | "tracks" | "hscrollbar">();

  // Sync scrollLeft whenever viewport.startRange or scale changes (e.g. from zoom)
  $effect(() => {
    const targetScrollLeft = viewport.startRange * scale;

    if (rulerViewportEl && Math.abs(rulerViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("ruler");
      rulerViewportEl.scrollLeft = targetScrollLeft;
    }
    if (tracksViewportEl && Math.abs(tracksViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("tracks");
      tracksViewportEl.scrollLeft = targetScrollLeft;
    }
    if (hScrollbarEl && Math.abs(hScrollbarEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("hscrollbar");
      hScrollbarEl.scrollLeft = targetScrollLeft;
    }
  });

  function syncScrollLeft(newScrollLeft: number, skip: "ruler" | "tracks" | "hscrollbar") {
    if (skip !== "ruler" && rulerViewportEl && rulerViewportEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("ruler");
      rulerViewportEl.scrollLeft = newScrollLeft;
    }
    if (skip !== "tracks" && tracksViewportEl && tracksViewportEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("tracks");
      tracksViewportEl.scrollLeft = newScrollLeft;
    }
    if (skip !== "hscrollbar" && hScrollbarEl && hScrollbarEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("hscrollbar");
      hScrollbarEl.scrollLeft = newScrollLeft;
    }

    const rangeWidth = viewport.endRange - viewport.startRange;
    // Clamp startRange so the viewport stays within [0, length] without changing rangeWidth
    const clampedStartRange = Math.max(0, Math.min(newScrollLeft / scale, length - rangeWidth));
    viewport.startRange = clampedStartRange;
    viewport.endRange = clampedStartRange + rangeWidth;
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
  }

  // Compute content-space x from a mouse event relative to a given scrollable element
  function contentXFromEvent(e: MouseEvent, el: HTMLDivElement): number {
    const rect = el.getBoundingClientRect();
    return e.clientX - rect.left + el.scrollLeft;
  }

  // Handle mouse move for caret (works for both ruler and tracks viewport)
  function handleMouseMove(e: MouseEvent) {
    const el = tracksViewportEl ?? rulerViewportEl;
    if (!el || scale <= 0) return;
    const mouseXInContent = contentXFromEvent(e, el);
    lastMouseX = mouseXInContent;
    caretValue = mouseXInContent / scale;
    caretX = mouseXInContent;
    showCaret = true;
  }

  function handleRulerMouseMove(e: MouseEvent) {
    if (!rulerViewportEl || scale <= 0) return;
    const mouseXInContent = contentXFromEvent(e, rulerViewportEl);
    lastMouseX = mouseXInContent;
    caretValue = mouseXInContent / scale;
    caretX = mouseXInContent;
    showCaret = true;
  }

  function handleMouseLeave() {
    showCaret = false;
  }

  // Update caret position when scale changes (e.g., during zoom)
  $effect(() => {
    // This effect runs when scale changes
    if (showCaret && lastMouseX > 0) {
      caretX = lastMouseX;
      caretValue = lastMouseX / scale;
    }
  });

  // Common click-to-select logic
  function applyClickSelect(mouseXInContent: number) {
    const clickValue = Math.floor(mouseXInContent / scale);
    selectionOffset = clickValue;
    selectionLength = 1;
    hasSelection = true;
    if (onselectionchange) {
      onselectionchange(selectionOffset, selectionLength);
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
  const hoverCaretViewportX = $derived(caretX - viewport.startRange * scale);

  // Calculate tracks height for content
  const TRACK_HEIGHT = 50;
  const tracksHeight = $derived(tracks.length * TRACK_HEIGHT);

  // Vertical virtualization: track the body-scroll element's scroll position
  let bodyScrollEl = $state<HTMLDivElement | null>(null);
  let bodyScrollTop = $state(0);
  let bodyScrollClientHeight = $state(0);

  function handleBodyScroll() {
    if (!bodyScrollEl) return;
    bodyScrollTop = bodyScrollEl.scrollTop;
  }

  // Derive which tracks are vertically visible (with one track of overdraw on each side)
  const firstVisibleTrackIndex = $derived(Math.max(0, Math.floor(bodyScrollTop / TRACK_HEIGHT) - 1));
  const lastVisibleTrackIndex = $derived(
    Math.min(tracks.length - 1, Math.ceil((bodyScrollTop + bodyScrollClientHeight) / TRACK_HEIGHT)),
  );
  const visibleTracks = $derived(
    tracks.slice(firstVisibleTrackIndex, lastVisibleTrackIndex + 1).map((track, i) => ({
      ...track,
      top: (firstVisibleTrackIndex + i) * TRACK_HEIGHT,
    })),
  );
</script>

<div class="timeline" style:height="{remainingHeight}px">
  {#if toolbar}
    <div class="timeline-toolbar">
      {@render toolbar()}
    </div>
  {/if}

  <div class="timeline-ruler-wrapper">
    <div class="timeline-ruler-spacer" aria-hidden="true"></div>
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
          value={caretValue}
          labelFormatter={rulerLabelFormatter}
          height={30}
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
      <div class="timeline-trackinfos-body" style="height: {tracksHeight}px;">
        {#each visibleTracks as track (track.id)}
          <TrackInfo trackId={track.id} top={track.top} />
        {/each}
      </div>
      <div
        role="button"
        tabindex="0"
        class="timeline-tracks-viewport"
        bind:this={tracksViewportEl}
        bind:clientWidth={containerWidth}
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
            <Track {viewport} items={track.items} {scale} top={track.top} />
          {/each}
          {#if showCaret && caretX >= 0 && caretX <= contentWidth}
            <Caret
              x={caretX}
              value={caretValue}
              labelFormatter={rulerLabelFormatter}
              height={tracksHeight}
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
