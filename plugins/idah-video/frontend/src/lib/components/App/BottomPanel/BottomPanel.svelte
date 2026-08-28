<script lang="ts">
  import { ui } from "$lib/state/ui.svelte";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { transformAnnotationsToTracks } from "$lib/components/App/VideoAnnotationWorkspace/utils/group-annotation.svelte";

  import TimelinePanel from "$lib/components/App/BottomPanel/_TimelinePanel.svelte";
  import TimelineToolbar from "$lib/components/App/BottomPanel/_TimelineToolbar.svelte";
  import Timeline from "$lib/components/App/Timeline/Timeline.svelte";
  import TimelineZoom from "$lib/components/App/Timeline/TimelineZoom.svelte";
  import VideoController from "$lib/components/App/Viewport/VideoController.svelte";
  import AnnotationTrackInfo from "$lib/components/App/Timeline/annotations/_AnnotationTrackInfo.svelte";
  import TrackInfoHeader from "$lib/components/App/Timeline/annotations/_TrackInfoHeader.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { notes } from "$lib/state/data.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";
  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import { ENTRY_ROOT, VIDEO_FRAME, type IVideoAnnotationRecord } from "$lib/types";
  import type Video from "$lib/components/App/Viewport/Video.svelte";
  import type { INoteRecord } from "$idah/v2/types";
  import EntryTrackBlock from "../Timeline/review/_EntryTrackBlock.svelte";
  import FrameTrackBlock from "../Timeline/annotations/_FrameTrackBlock.svelte";

  // Props
  interface Props {
    viewportAnnotations: IVideoAnnotationRecord[];
    frameAnnotations: IVideoAnnotationRecord[];
    entryRootAnnotation?: IVideoAnnotationRecord;
    length: number;
    player: Video | undefined;
    volume: { level: number; muted: boolean };
  }
  let { viewportAnnotations, frameAnnotations, entryRootAnnotation, length, player = $bindable(), volume }: Props = $props();

  // Internal state
  let panelHeight: number = $state(0);
  let toolbarHeight: number = $state(0);
  let zoomFn: ((newZoom: number, center?: number) => void) | undefined = $state();

  const TARGET_MAJOR_STEP_PX = 80;
  const TARGET_MINOR_STEP_PX = 20;

  function generateSeriesUpTo(target: number): number[] {
    const series: number[] = [1];
    let current = 1;
    let idx = 1;
    while (current < target) {
      idx++;
      current = series[idx - 2] * (idx % 2 === 0 ? 2 : 5);
      series.push(current);
    }
    return series;
  }

  function roundToSeries(target: number): number {
    if (target <= 1) return 1;
    const series = generateSeriesUpTo(target);
    let closest = series[0];
    for (const val of series) {
      if (val <= target) closest = val;
    }
    const nextIdx = series.indexOf(closest) + 1;
    const nextVal = nextIdx < series.length ? series[nextIdx] : Infinity;
    return Math.abs(target - closest) <= Math.abs(target - nextVal) ? closest : nextVal;
  }

  const containerWidth = $derived(viewport.timeline.dimensions[0]);

  const effectiveRulerMajorStep = $derived.by<number>(() => {
    if (containerWidth <= 0) return 50;
    let target =
      (TARGET_MAJOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / containerWidth;
    // In time mode, labels are wider (h:mm:ss or m:ss), so we need more spacing.
    // Round to whole seconds to get clean time labels. Minimum 1 second.
    if (ui.timeDisplay === "time") {
      const fps = media.fps;
      // Round to nearest second, never below 1
      const seconds = Math.max(1, Math.round(target / fps));
      return seconds * fps;
    }
    return Math.max(1, roundToSeries(Math.max(1, target)));
  });

  const effectiveRulerMinorStep = $derived.by<number>(() => {
    if (containerWidth <= 0) return 10;
    const target =
      (TARGET_MINOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / containerWidth;
    const rounded = roundToSeries(Math.max(1, target));
    return rounded === effectiveRulerMajorStep ? 0 : rounded;
  });

  let entryNotes: INoteRecord[] = $derived(viewport.isReviewWorkspace ? notes.list : []);
  let pinnedNotes = $derived(entryNotes.filter((n) => {
    const pos = n.anchor.position as { frame?: number } | undefined;
    return pos?.frame !== undefined && n.anchor.anchor_type === "entry";
  }))
  let sortedPinnedNotes = $derived(pinnedNotes.sort((a, b) => {
    const fa = (a.anchor.position as { frame?: number } | undefined)?.frame ?? 0;
    const fb = (b.anchor.position as { frame?: number } | undefined)?.frame ?? 0;
    return fa - fb;
  }))

  let items = $derived.by(() => {
    return transformAnnotationsToTracks({
      annotations: viewportAnnotations,
      labelConfig: getDriver().config
    })
  })

  // Entry notes row — rendered as a sticky row between ruler and tracks
  let noteItems = $derived.by(() => {
    if (!viewport.isReviewWorkspace || sortedPinnedNotes.length === 0) return [];
    return [{
      trackId: "__entry_notes__",
      startRange: (sortedPinnedNotes.at(0)?.anchor.position as {frame: number}).frame,
      endRange: (sortedPinnedNotes.at(-1)?.anchor.position as {frame: number}).frame,
      rawData: sortedPinnedNotes,
      component: EntryTrackBlock,
    }]
  })

  // Meta row — rendered as a sticky row between ruler and tracks, visible in
  // both annotate and review modes (unlike the Notes row, which is review-only).
  // rawData carries both the per-frame meta and the entry:root annotation so the
  // row can render the entry:root outer cell plus the individual frame markers.
  // The row only appears when a meta label config exists (entry:root or idah-video:frame),
  // mirroring the sidebar tabs' visibility rule.
  let hasMetaConfig = $derived(Boolean(getDriver().config[ENTRY_ROOT]) || Boolean(getDriver().config[VIDEO_FRAME]));
  let frameItems = $derived.by(() => {
    if (!hasMetaConfig) return [];
    if (frameAnnotations.length === 0 && !entryRootAnnotation) return [];
    return [{
      trackId: "__frame_tags__",
      startRange: frameAnnotations[0]?.shape.start ?? entryRootAnnotation?.shape.start ?? 0,
      endRange: frameAnnotations[frameAnnotations.length - 1]?.shape.start ?? entryRootAnnotation?.shape.end ?? 0,
      rawData: { frameAnnotations, entryRootAnnotation },
      component: FrameTrackBlock,
    }]
  })

  // All meta annotations (entry:root + all frame meta) for the header controls.
  let allMeta = $derived([...frameAnnotations, ...(entryRootAnnotation ? [entryRootAnnotation] : [])]);
  let allMetaHidden = $derived(allMeta.length > 0 && allMeta.every((a) => annotation.isHidden(a)));
  let allMetaLocked = $derived(allMeta.length > 0 && allMeta.every((a) => annotation.isLocked(a)));

  function toggleMetaVisibility() {
    const newHidden = !allMetaHidden;
    for (const a of allMeta) annotation.toggleHidden(a.id, newHidden);
  }

  function toggleMetaLocked() {
    const newLocked = !allMetaLocked;
    for (const a of allMeta) annotation.toggleLocked(a.id, newLocked);
  }
</script>

<TimelinePanel bind:panelHeight>
  <TimelineToolbar bind:toolbarHeight>
    <VideoController {volume} bind:video={player} />
    <TimelineZoom {zoomFn} />
  </TimelineToolbar>

  <Timeline
    onZoom={(fn) => (zoomFn = fn)}
    bind:viewport={viewport.timeline.range}
    {items}
    {length}
    {noteItems}
    {frameItems}
    remainingHeight={panelHeight - toolbarHeight}
    rulerSmallStep={effectiveRulerMinorStep}
    rulerBigStep={effectiveRulerMajorStep}
    currentFrame={viewport.video.currentFrame.value}
    onselectionchange={(frame) => viewport.video.goToFrame(frame)}
    onDimensionsChange={(w, h) => {
      viewport.timeline.dimensions = [w, h];
    }}
  >
    {#snippet TrackInfoHeaderSlot()}
      <TrackInfoHeader annotations={viewportAnnotations} />
    {/snippet}

    {#snippet TrackInfoSlot({ track })}
      <AnnotationTrackInfo {track} />
    {/snippet}

    {#snippet NoteTrackInfoSlot()}
      <div
        role="button"
        tabindex="-1"
        class="flex h-full cursor-pointer items-center px-2 select-none"
      >
        <p class="text-xs font-medium">Notes</p>
      </div>
    {/snippet}

    {#snippet FrameTrackInfoSlot()}
      <div
        role="button"
        tabindex="-1"
        class="group flex h-full cursor-pointer items-center px-2 select-none"
      >
        <p class="text-xs font-medium">Meta</p>
        <div class="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100">
          <KbdTooltipButton
            label="Show/Hide all meta"
            icon={allMetaHidden ? EyeOffIcon : EyeIcon}
            variant="ghost"
            size="icon-sm"
            disabled={allMeta.length === 0}
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              toggleMetaVisibility();
            }}
          />
          <KbdTooltipButton
            label="Lock/Unlock all meta"
            icon={allMetaLocked ? LockIcon : LockOpenIcon}
            variant="ghost"
            size="icon-sm"
            disabled={allMeta.length === 0}
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              toggleMetaLocked();
            }}
          />
          <KbdTooltipButton
            label="Remove all meta"
            icon={Trash2Icon}
            variant="ghost"
            size="icon-sm"
            disabled={!isEditable() || allMeta.length === 0 || allMeta.some((a) => annotation.isLocked(a)) || viewport.isReviewWorkspace}
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              showConfirmDialog({
                title: "Remove all meta",
                description: "Are you sure you want to remove all meta annotations (entry and frame)?",
                onConfirm: () => {
                  getDriver().command.call("idah-video:annotation.group.delete", {
                    groupId: "__meta__",
                    annotations: allMeta,
                  });
                },
              });
            }}
          />
        </div>
      </div>
    {/snippet}
  </Timeline>
</TimelinePanel>
