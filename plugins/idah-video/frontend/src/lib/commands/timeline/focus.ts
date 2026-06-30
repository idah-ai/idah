// ---------------------------------------------------------------------------
// timeline.focus — Zoom the timeline to the selected group or annotation's
// frame range.
//
// When a group is selected, focuses on the full group range.
// When an annotation is selected, focuses on that single annotation's range.
// Falls back to no-op if nothing is selected.
//
// Shortcut: F
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { data } from "$lib/state/data.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$lib/types";

export const command = {
  name: "timeline.focus",
  group: "Timeline",
  modes: ["editor", "review"],
  shortcut: "Control+F",
  shortDescription: "Focus timeline",
  longDescription: "Zoom the timeline to the selected group or annotation's frame range",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (): ICommandAction => {
      const sel = selection.value;
      if (!sel) {
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

      let start: number | undefined;
      let end: number | undefined;

      if (sel.type === "annotation") {
        const shape = (sel.annotation as any).shape as IVideoAnnotationShape | undefined;
        if (shape) {
          start = shape.start;
          end = shape.end;
        }
      } else if (sel.type === "group") {
        const groupId = sel.groupId;
        for (const ann of data.annotations?.items ?? []) {
          const annGroupId = (ann as any).metadata?.group_id ?? ann.id;
          if (annGroupId !== groupId) continue;
          const shape = ann.shape as IVideoAnnotationShape | undefined;
          if (!shape) continue;
          if (start === undefined || shape.start < start) start = shape.start;
          if (end === undefined || shape.end > end) end = shape.end;
        }
      }

      if (start === undefined || end === undefined) {
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

      const margin = Math.max(10, Math.round((end - start) * 0.1));

      return {
        command: command as any,
        do() {
          viewport.timeline.range = {
            startRange: Math.max(0, start - margin),
            endRange: Math.min(media.totalFrames, end + margin),
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
