// ---------------------------------------------------------------------------
// annotation.extend_prev — Extend the previous annotation's end to a frame
//
// Shortcut:  [  (default mode) — extends the annotation before the current
//            frame in the selected group.
//
// Can also be called with explicit props from the context menu:
//   driver.command.call("annotation.extend_prev", { annotationId, frame, items });
//
// Prevents overlapping with the next annotation in the group.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { nearestKeyframe } from "$lib/utils/interpolation";
import { noopAction } from "..";
import { annotation } from "$lib/state/annotation.svelte";

export const command = {
  name: "annotation.extend_prev",
  group: "Annotation",
  modes: ["default"],
  shortcut: "BracketRight",
  shortDescription: "Extend previous annotation",
  longDescription: "Extend the previous annotation to the current frame",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      return {
        command: {
          name: "annotation.extend_prev",
          group: "Annotation",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          // ── Resolve target annotation and frame ────────────────────────
          // If called with explicit props (context menu), use them.
          // Otherwise resolve from the current selection state (shortcut path).
          const frame = (opts?.frame as number | undefined) ?? viewport.video.currentFrame.value;

          // Find the annotations in the currently selected group
          let groupAnnotations: {
            id: string;
            shape: {
              type: string;
              start: number;
              end: number;
              frames: { frame: number; angle: number; points: [number, number][] }[];
            };
          }[];

          if (opts?.annotationId) {
            // Context menu knows exactly which annotation
            const annotationId = opts.annotationId as string;
            const all = data.annotations?.items ?? [];
            const target = all.find((a) => a.id === annotationId);

            // If no target annotation or target is locked, abort.
            if (!target || annotation.isLocked(target)) return;

            // Build a list for the overlap check: same group as the target
            const gid = (target.metadata as any)?.group_id ?? annotationId;
            groupAnnotations = all
              .filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid)
              .map((a) => ({ id: a.id, shape: a.shape as any }));
          } else {
            // Shortcut: resolve from selection
            const sel = selection.value;
            if (!sel) return;

            let gid: string;
            if (sel.type === "group") {
              gid = sel.groupId;
            } else if (sel.type === "annotation") {
              gid = (sel.annotation.metadata as any)?.group_id ?? sel.annotation.id;
            } else {
              return;
            }

            // If the current group is locked, abort.
            if (annotation.isLocked(gid)) return;

            groupAnnotations = (data.annotations?.items ?? [])
              .filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid)
              .map((a) => ({ id: a.id, shape: a.shape as any }));
          }

          // Find the annotation whose end is closest to but before `frame`
          const prevAnn = groupAnnotations
            .filter((a) => {
              const lastFrame = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
              return lastFrame < frame;
            })
            .sort((a, b) => {
              const aEnd = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
              const bEnd = b.shape.frames?.[b.shape.frames.length - 1]?.frame ?? -1;
              return bEnd - aEnd;
            })[0];

          if (!prevAnn) return;

          // Overlap protection: don't exceed the next annotation's start
          const nextAnn = groupAnnotations
            .filter((a) => {
              const firstFrame = a.shape.frames?.[0]?.frame ?? Infinity;
              return firstFrame > frame && a.id !== prevAnn.id;
            })
            .sort((a, b) => (a.shape.frames?.[0]?.frame ?? Infinity) - (b.shape.frames?.[0]?.frame ?? Infinity))[0];

          let cappedFrame = frame;
          if (nextAnn) {
            const nextStart = nextAnn.shape.frames?.[0]?.frame ?? Infinity;
            if (frame >= nextStart) cappedFrame = nextStart - 1;
          }

          const nearest = nearestKeyframe(prevAnn.shape, cappedFrame);
          if (!nearest) return;

          driver.command.call("annotation.keyframe_add", {
            annotationId: prevAnn.id,
            selection: {
              frame: cappedFrame,
              ...nearest,
            },
          });
        },
        // No undo — the nested keyframe_add handles its own undo.
        isCombinable() {
          return false;
        },
        combine(p: never) {
          return p;
        },
      };
    },
  });
}
