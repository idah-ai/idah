// ---------------------------------------------------------------------------
// timeline.zoom_in — Zoom into the timeline view
//
// Shortcut: Control+Equal (Cmd+= on Mac, Ctrl+= on Windows)
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "timeline.zoom_in",
  group: "Timeline",
  modes: ["default", "review"] as string[],
  shortcut: "Control+Equal",
  shortDescription: "Zoom timeline in",
  longDescription: "Zoom into the timeline view",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => ({
      command: { ...command },
      do() {
        const totalFrames = media.totalFrames > 0 ? media.totalFrames : 1;
        const containerWidth = viewport.timeline.dimensions[0];
        const rangeWidth = viewport.timeline.range.endRange - viewport.timeline.range.startRange;

        if (rangeWidth <= 0) return;

        const currentZoom = totalFrames / rangeWidth;
        const zoomMin = 1;
        const zoomMax = containerWidth > 0 ? Math.max(zoomMin, (totalFrames * 80) / containerWidth) : zoomMin;

        const ZOOM_FACTOR = 1.1;
        const newZoom = Math.min(Math.round(currentZoom * ZOOM_FACTOR * 10) / 10, zoomMax);

        // Apply zoom centered on the current frame
        const newRange = totalFrames / newZoom;
        const center = viewport.video.currentFrame.value;
        let newStart = center - newRange / 2;
        let newEnd = center + newRange / 2;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRange;
        }
        if (newEnd > totalFrames) {
          newEnd = totalFrames;
          newStart = totalFrames - newRange;
        }

        viewport.timeline.range = {
          startRange: newStart,
          endRange: newEnd,
        };
      },
      isCombinable() {
        return false;
      },
      combine(prev: any) {
        return prev;
      },
    }),
    group: command.group,
  });
}
