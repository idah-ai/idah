<script lang="ts">
  import type { Snippet } from "svelte";

  import Caret from "$lib/plugin/video-annotation-activity/timelines/caret.svelte";
  import Ruler from "$lib/plugin/video-annotation-activity/timelines/ruler.svelte";

  import type { TimelineProps, Viewport } from "$lib/plugin/video-annotation-activity/timelines/types";
  import Selection from "./selection.svelte";
  import TrackInfo from "./track-info.svelte";
  import Track from "./track.svelte";

  interface Props extends TimelineProps {
    toolbar?: Snippet;
    remainingHeight: number;
    onViewportContainerWidthChange?: (width: number) => void;
    onViewportChange?: (viewport: Viewport, zoomLevel: number) => void;
    onSelectionChange?: (offset: number, length: number) => void;
  }

  let {
    viewport,
    items,
    totalFrames,
    rulerMajorStep = 10,
    rulerMinorStep = 50,
    remainingHeight,
    rulerLabelFormatter,
    toolbar,
    onViewportContainerWidthChange,
    onViewportChange,
    onSelectionChange,
  }: Props = $props();

  // Constants
  const TIMELINE_TRACK_INFO_WIDTH = 300;

  // Variables:: Elements
  let timelineRulerViewportEl = $state<HTMLDivElement | null>(null);
  let timelineTracksViewportEl = $state<HTMLDivElement | null>(null);
  let timelineBodyScrollEl = $state<HTMLDivElement | null>(null);
  let timelineBodyScrollTop = $state<number>(0);
  let timelineBodyScrollClientHeight = $state<number>(0);
  let timelineHScrollbarEl = $state<HTMLDivElement | null>(null);

  // Variables:: ContainerViewport
  let viewportContainerWidth = $state<number>(0);
  let timelineRulerContainerHeight = $state<number>(0);

  // Variables:: Viewport
  const viewportRange = $derived(viewport.endRange - viewport.startRange);
  let scale = $derived(viewportContainerWidth > 0 ? viewportContainerWidth / viewportRange : 1);

  // Total context pixel width
  let contentWidth = $derived(totalFrames * scale);

  // Variables:: Selection state
  let selectionOffset = $state<number>(0);
  let selectionLength = $state<number>(1);
  let hasSelection = $state<boolean>(false);

  // Variables:: Zoom
  let zoomLevel = $derived(totalFrames / (viewport.endRange - viewport.startRange));

  // Variables:: Caret
  let showCaret = $state<boolean>(false);
  let caretX = $state<number>(0);
  let caretValue = $state<number>(0);
  let lastMouseX = $state<number>(0);
  let selectionCaretViewportX = $derived((selectionOffset - viewport.startRange) * scale);
  let hoverCaretViewportX = $derived<number>(caretX - viewport.startRange * scale);

  // Variables:: Track
  const TRACK_HEIGHT = 50;

  let tracks = $derived(
    [...new Set(items.map((item) => item.trackId))].map((trackId) => ({
      id: trackId,
      items: items.filter((item) => item.trackId === trackId),
    })),
  );

  let firstVisibleTrackIndex = $derived(Math.max(0, Math.floor(timelineBodyScrollTop / TRACK_HEIGHT) - 1));
  let lastVisibleTrackIndex = $derived(
    Math.min(tracks.length - 1, Math.ceil((timelineBodyScrollTop + timelineBodyScrollClientHeight) / TRACK_HEIGHT)),
  );

  let visibleTracks = $derived(
    tracks.slice(firstVisibleTrackIndex, lastVisibleTrackIndex + 1).map((track, i) => ({
      ...track,
      top: (firstVisibleTrackIndex + i) * TRACK_HEIGHT,
    })),
  );
  let tracksHeight = $derived(tracks.length * TRACK_HEIGHT);
  // let tracksHeight = $derived(remainingHeight - timelineRulerContainerHeight);

  // Emit viewportContainerWidth changes to parent
  $effect(() => {
    if (onViewportContainerWidthChange && viewportContainerWidth > 0) {
      onViewportContainerWidthChange(viewportContainerWidth);
    }
  });

  // Clamp viewport to valid bounds whenever it changes from any source.
  // Preserves range width when only translating; shrinks to [0, totalFrames] if range exceeds length.
  $effect(() => {
    const rangeWidth = viewport.endRange - viewport.startRange;
    if (rangeWidth <= 0) return;

    let newStart = viewport.startRange;
    let newEnd = viewport.endRange;

    if (rangeWidth >= totalFrames) {
      // Range is wider than (or equal to) the entire content - show everything
      newStart = 0;
      newEnd = totalFrames;
    } else if (newStart < 0) {
      // Slide right to the start, keeping width
      newStart = 0;
      newEnd = rangeWidth;
    } else if (newEnd > totalFrames) {
      newEnd = totalFrames;
      newStart = totalFrames - rangeWidth;
    }

    if (newStart !== viewport.startRange) viewport.startRange = newStart;
    if (newEnd !== viewport.endRange) viewport.endRange = newEnd;

    // if (newStart !== viewport.startRange && newEnd !== viewport.endRange) {
    //   onViewportChange?.({ startRange: newStart, endRange: newEnd }, zoomLevel);
    // }
  });

  // Track in-flight programmatic scrolls per element to prevent feedback loops.
  // Using a Set so ruler, tracks and hscrollbar can all be pending simultaneously.
  const pendingProgrammatic = new Set<"ruler" | "tracks" | "hscrollbar">();

  // Sync scrollLeft whenever viewport.startRange or scale changes (e.g. from zoom)
  $effect(() => {
    const targetScrollLeft = viewport.startRange * scale;

    if (timelineRulerViewportEl && Math.abs(timelineRulerViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("ruler");
      timelineRulerViewportEl.scrollLeft = targetScrollLeft;
    }
    if (timelineTracksViewportEl && Math.abs(timelineTracksViewportEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("tracks");
      timelineTracksViewportEl.scrollLeft = targetScrollLeft;
    }
    if (timelineHScrollbarEl && Math.abs(timelineHScrollbarEl.scrollLeft - targetScrollLeft) > 0.5) {
      pendingProgrammatic.add("hscrollbar");
      timelineHScrollbarEl.scrollLeft = targetScrollLeft;
    }
  });

  // Update caret position when scale changes (e.g., during zoom)
  $effect(() => {
    // This effect runs when scale changes
    if (showCaret && lastMouseX > 0) {
      caretX = lastMouseX;
      caretValue = lastMouseX / scale;
    }
  });

  // Functions
  function syncScrollLeft(newScrollLeft: number, skip: "ruler" | "tracks" | "hscrollbar") {
    if (skip !== "ruler" && timelineRulerViewportEl && timelineRulerViewportEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("ruler");
      timelineRulerViewportEl.scrollLeft = newScrollLeft;
    }
    if (skip !== "tracks" && timelineTracksViewportEl && timelineTracksViewportEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("tracks");
      timelineTracksViewportEl.scrollLeft = newScrollLeft;
    }
    if (skip !== "hscrollbar" && timelineHScrollbarEl && timelineHScrollbarEl.scrollLeft !== newScrollLeft) {
      pendingProgrammatic.add("hscrollbar");
      timelineHScrollbarEl.scrollLeft = newScrollLeft;
    }
    const rangeWidth = viewport.endRange - viewport.startRange;
    // Clamp startRange so the viewport stays within [0, length] without changing rangeWidth
    const clampedStartRange = Math.max(0, Math.min(newScrollLeft / scale, length - rangeWidth));
    viewport.startRange = clampedStartRange;
    viewport.endRange = clampedStartRange + rangeWidth;
    // onViewportChange?.({ startRange: clampedStartRange, endRange: clampedStartRange + rangeWidth }, zoomLevel);
  }

  function handleRulerScroll() {
    if (pendingProgrammatic.has("ruler")) {
      pendingProgrammatic.delete("ruler");
      return;
    }
    if (!timelineRulerViewportEl || scale <= 0) return;
    syncScrollLeft(timelineRulerViewportEl.scrollLeft, "ruler");
  }

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

  function handleRulerMouseMove(e: MouseEvent) {
    if (!timelineRulerViewportEl || scale <= 0) return;
    const mouseXInContent = contentXFromEvent(e, timelineRulerViewportEl);
    lastMouseX = mouseXInContent;
    caretValue = mouseXInContent / scale;
    caretX = mouseXInContent;
    showCaret = true;
  }

  function handleMouseMove(e: MouseEvent) {
    const el = timelineTracksViewportEl ?? timelineRulerViewportEl;
    if (!el || scale <= 0) return;
    const mouseXInContent = contentXFromEvent(e, el);
    lastMouseX = mouseXInContent;
    caretValue = mouseXInContent / scale;
    caretX = mouseXInContent;
    showCaret = true;
  }

  function handleMouseLeave() {
    showCaret = false;
  }

  function handleWheel(e: WheelEvent) {
    if (!e.metaKey || scale <= 0) return;

    e.preventDefault();

    // Use tracks viewport for wheel events
    const el = timelineTracksViewportEl || timelineRulerViewportEl;
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

  function applyClickSelect(mouseXInContent: number) {
    let clickValue = Math.floor(mouseXInContent / scale);
    if (clickValue > totalFrames) clickValue = totalFrames;

    selectionOffset = clickValue;
    selectionLength = 1;
    hasSelection = true;

    if (onSelectionChange) {
      onSelectionChange(selectionOffset, selectionLength);
    }
  }

  // Handle click to set selection (ruler viewport)
  function handleRulerClick(e: MouseEvent) {
    if (!timelineRulerViewportEl || scale <= 0) return;
    applyClickSelect(contentXFromEvent(e, timelineRulerViewportEl));
  }

  // Handle click to set selection (tracks viewport)
  function handleTrackClick(e: MouseEvent) {
    if (!timelineTracksViewportEl || scale <= 0) return;
    applyClickSelect(contentXFromEvent(e, timelineTracksViewportEl));
  }

  function handleBodyScroll() {
    if (!timelineBodyScrollEl) return;
    timelineBodyScrollTop = timelineBodyScrollEl.scrollTop;
  }

  let lastTracksScrollLeft = 0;

  function handleTracksScroll() {
    if (pendingProgrammatic.has("tracks")) {
      pendingProgrammatic.delete("tracks");
      return;
    }
    if (!timelineTracksViewportEl || scale <= 0) return;
    // Ignore events that didn't change horizontal position (vertical scroll)
    if (timelineTracksViewportEl.scrollLeft === lastTracksScrollLeft) return;
    lastTracksScrollLeft = timelineTracksViewportEl.scrollLeft;
    syncScrollLeft(timelineTracksViewportEl.scrollLeft, "tracks");
  }

  function handleHScrollbarScroll() {
    if (pendingProgrammatic.has("hscrollbar")) {
      pendingProgrammatic.delete("hscrollbar");
      return;
    }
    if (!timelineHScrollbarEl || scale <= 0) return;
    syncScrollLeft(timelineHScrollbarEl.scrollLeft, "hscrollbar");
  }
</script>

<div id="timeline" class="flex w-full flex-col border">
  {#if toolbar}
    <div id="timeline-toolbar" class="flex shrink-0">
      {@render toolbar()}
    </div>
  {/if}

  <div
    id="timeline-ruler-wrapper"
    class="relative flex w-full shrink-0"
    bind:clientHeight={timelineRulerContainerHeight}
  >
    <div
      id="timeline-ruler-spacer"
      aria-hidden="true"
      class="flex h-9 shrink-0 items-center border-r border-b px-2"
      style="width: {TIMELINE_TRACK_INFO_WIDTH}px"
    >
      Annotations (Actions)
    </div>

    <div
      id="timeline-ruler-viewport"
      role="button"
      tabindex="0"
      class="timeline-ruler-viewport"
      bind:this={timelineRulerViewportEl}
      bind:clientWidth={viewportContainerWidth}
      onscroll={handleRulerScroll}
      onwheel={handleRulerWheel}
      onmousemove={handleRulerMouseMove}
      onmouseleave={handleMouseLeave}
      onclick={handleRulerClick}
      onkeypress={() => {}}
    >
      <Ruler {viewport} {scale} {rulerMajorStep} {rulerMinorStep} {rulerLabelFormatter} />
    </div>

    <div
      id="timeline-ruler-caret-overlay"
      aria-hidden="true"
      class="pointer-events-none absolute top-0 right-0 bottom-0 z-10 overflow-hidden"
      style:left="{TIMELINE_TRACK_INFO_WIDTH}px"
    >
      <!-- CARET LABEL::SELECTED ON RULER -->
      {#if hasSelection && selectionOffset >= 0 && selectionOffset < totalFrames && selectionCaretViewportX >= 0 && selectionCaretViewportX <= viewportContainerWidth}
        <Caret
          x={selectionCaretViewportX}
          value={selectionOffset}
          labelFormatter={rulerLabelFormatter}
          height={36}
          color="primary"
          showLabel
        />
      {/if}

      <!-- CARET LABEL::HOVER ON RULER -->
      {#if showCaret && hoverCaretViewportX >= 0 && hoverCaretViewportX <= viewportContainerWidth}
        <Caret
          x={hoverCaretViewportX}
          value={caretValue}
          labelFormatter={rulerLabelFormatter}
          height={36}
          color="secondary"
          showLabel
        />
      {/if}
    </div>
  </div>

  <div
    id="timeline-body-scroll"
    class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
    bind:this={timelineBodyScrollEl}
    bind:clientHeight={timelineBodyScrollClientHeight}
    onscroll={handleBodyScroll}
  >
    <div id="timeline-main" class="flex">
      <div
        id="timeline-trackinfos-body"
        class="relative shrink-0"
        style:width="{TIMELINE_TRACK_INFO_WIDTH}px"
        style:height="{tracksHeight}px"
      >
        {#each visibleTracks as visibleTrack (visibleTrack.id)}
          <TrackInfo trackId={visibleTrack.id} top={visibleTrack.top} />
        {/each}
      </div>

      <div
        role="button"
        tabindex="0"
        id="timeline-tracks-viewport"
        class="timeline-tracks-viewport"
        bind:this={timelineTracksViewportEl}
        bind:clientWidth={viewportContainerWidth}
        onscroll={handleTracksScroll}
        onwheel={handleWheel}
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
        onclick={handleTrackClick}
        onkeypress={() => {}}
      >
        <div id="timeline-tracks-content" class="relative" style:height="{tracksHeight}px">
          {#if hasSelection && selectionOffset >= 0 && selectionOffset < totalFrames}
            <!-- SELECTION BLOCK -->
            <Selection
              offset={selectionOffset}
              length={selectionLength}
              {scale}
              height={tracksHeight}
              trackLength={totalFrames}
            />
            <!-- CARET LINE::SELECTED ON TRACKS -->
            <Caret
              x={selectionOffset * scale}
              value={selectionOffset}
              labelFormatter={rulerLabelFormatter}
              height={tracksHeight}
              color="primary"
              showLine
            />
          {/if}

          {#each visibleTracks as visibleTrack (visibleTrack.id)}
            <Track {viewport} items={visibleTrack.items} {scale} top={visibleTrack.top} />
          {/each}

          {#if showCaret && caretX >= 0 && caretX <= contentWidth}
            <Caret
              x={caretX}
              value={caretValue}
              labelFormatter={rulerLabelFormatter}
              height={tracksHeight}
              color="secondary"
              showLine
            />
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div id="timeline-hscrollbar-wrapper" class="flex shrink-0 border-t">
    <div id="timeline-hscrollbar-spacer" aria-hidden="true" style:width="{TIMELINE_TRACK_INFO_WIDTH}px"></div>
    <div id="timeline-hscroolbar" bind:this={timelineHScrollbarEl} onscroll={handleHScrollbarScroll}>
      <div style="width: {contentWidth}px; height: 1px;" aria-hidden="true"></div>
    </div>
  </div>
</div>

<style>
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

  /* Horizontal-only scroll viewport for the tracks area.
	   Native scrollbar is hidden — the custom hscrollbar below is used instead. */
  .timeline-tracks-viewport {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
</style>
