// ---------------------------------------------------------------------------
// timeline.scroll_to_annotation — Pan the timeline to reveal the selected
// annotation's start frame at the current zoom level.
//
// Shifts the viewport so the annotation's start frame sits ~10 frames from
// the left edge. The visible range width (scale) is preserved unchanged.
// The start is clamped to 0 when the margin would make it negative.
// ---------------------------------------------------------------------------
import { selection, type IAnnotationSelection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$lib/types";

export const command = {
  name: "timeline.scroll_to_annotation",
  group: "Timeline",
  modes: ["default", "review"],
  shortcut: null,
  shortDescription: "Scroll timeline to annotation",
  longDescription: "Pan the timeline to show the selected annotation's start frame without changing the zoom level",
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

      const shape = sel.annotation.shape as IVideoAnnotationShape | undefined;

      if (!shape) {
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

      const { startRange, endRange } = viewport.timeline.range;
      const margin = Math.max(10, Math.round((shape.end - shape.start) * 0.1));
      const newStart = Math.max(0, shape.start - margin);
      const rangeWidth = endRange - startRange;
      const newEnd = newStart + rangeWidth;

      return {
        command: command as any,
        do() {
          viewport.timeline.range = {
            startRange: newStart,
            endRange: newEnd,
          };
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
