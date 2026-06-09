// ---------------------------------------------------------------------------
// timeline.scroll_to_annotation — Pan the timeline to the current frame when
// it is outside the viewport, keeping the current zoom level.
//
// If `viewport.video.currentFrame` is already visible within the viewport
// range, the viewport is left unchanged — no unnecessary scrolling when the
// user is already looking at the relevant part of the timeline.
//
// When the current frame is outside the viewport, it is centered horizontally
// in the viewport, preserving the current zoom scale (range width). The result
// is clamped to [0, totalFrames] so boundaries are handled gracefully.
// ---------------------------------------------------------------------------
import { selection, type IAnnotationSelection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

export const command = {
  name: "timeline.scroll_to_annotation",
  group: "Timeline",
  modes: ["default", "review"],
  shortcut: null,
  shortDescription: "Scroll timeline to annotation",
  longDescription: "Pan the timeline to show the current frame without changing the zoom level",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (): ICommandAction => {
      const sel = selection.value as IAnnotationSelection;

      if (!selection.isAnnotation()) {
        return {
          command: command as any,
          do() {},
          isCombinable() {
            return false;
          },
          combine(p: any) {
            return p;
          },
        };
      }

      return {
        command: command as any,
        do() {
          const totalFrames = media.totalFrames;
          const { startRange, endRange } = viewport.timeline.range;
          const rangeWidth = endRange - startRange;
          if (rangeWidth <= 0) return;

          const currentFrame = viewport.video.currentFrame.value;

          // If the current frame is already visible, don't shift the viewport
          if (currentFrame >= startRange && currentFrame <= endRange) return;

          // Center the current frame in the viewport, preserving zoom scale
          let newStart = currentFrame - rangeWidth / 2;
          let newEnd = currentFrame + rangeWidth / 2;

          // Clamp to valid frame bounds
          if (newStart < 0) {
            newStart = 0;
            newEnd = rangeWidth;
          }
          if (newEnd > totalFrames) {
            newEnd = totalFrames;
            newStart = Math.max(0, totalFrames - rangeWidth);
          }

          viewport.timeline.range = { startRange: newStart, endRange: newEnd };
        },
        isCombinable() {
          return false;
        },
        combine(p: any) {
          return p;
        },
      };
    },
    group: command.group,
  });
}
