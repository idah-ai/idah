// ---------------------------------------------------------------------------
// annotation.extend_next — Extend the next annotation's start to a frame
//
// Shortcut:  ]  (default mode) — extends the annotation after the current
//            frame in the selected group.
//
// Can also be called with explicit props from the context menu:
//   driver.command.call("annotation.extend_next", { annotationId, frame, items });
//
// Prevents overlapping with the previous annotation in the group.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { nearestKeyframe } from "$lib/utils/interpolation";
import { noopAction } from "..";
import { annotation } from "$lib/state/annotation.svelte";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "annotation.extend_next",
  group: "Annotation",
  modes: ["editor"],
  shortcut: "BracketLeft",
  shortDescription: "Extend next annotation",
  longDescription: "Extend the next annotation to the current frame",
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
      if (!isEditable()) return noopAction(command);

      return {
        command: {
          name: "annotation.extend_next",
          group: "Annotation",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          // ── Resolve target annotation and frame ────────────────────────
          const frame = (opts?.frame as number | undefined) ?? viewport.video.currentFrame.value;

          // Resolve group annotations
          let groupAnnotations: {
            id: string;
            shape: { frames: { frame: number; angle: number; points: [number, number][] }[] };
          }[];
          if (opts?.annotationId) {
            const annotationId = opts.annotationId as string;
            const all = data.annotations?.items ?? [];
            const target = all.find((a) => a.id === annotationId);

            // If no target annotation or target is locked, abort.
            if (!target || annotation.isLocked(target)) return;

            const gid = (target.metadata as any)?.group_id ?? annotationId;
            groupAnnotations = all
              .filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid)
              .map((a) => ({ id: a.id, shape: a.shape as any }));
          } else {
            const sel = selection.value;

            // If no selection, abort.
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

          // Find the annotation whose start is closest to but after `frame`
          const nextAnn = groupAnnotations
            .filter((a) => {
              const firstFrame = a.shape.frames?.[0]?.frame ?? Infinity;
              return firstFrame > frame;
            })
            .sort((a, b) => (a.shape.frames?.[0]?.frame ?? Infinity) - (b.shape.frames?.[0]?.frame ?? Infinity))[0];

          if (!nextAnn) return;

          // Overlap protection: don't go below the previous annotation's end
          const prevAnn = groupAnnotations
            .filter((a) => {
              const lastFrame = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
              return lastFrame < frame && a.id !== nextAnn.id;
            })
            .sort((a, b) => {
              const aEnd = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
              const bEnd = b.shape.frames?.[b.shape.frames.length - 1]?.frame ?? -1;
              return bEnd - aEnd;
            })[0];

          let cappedFrame = frame;
          if (prevAnn) {
            const prevEnd = prevAnn.shape.frames?.[prevAnn.shape.frames.length - 1]?.frame ?? -Infinity;
            if (frame <= prevEnd) cappedFrame = prevEnd + 1;
          }

          const nearest = nearestKeyframe(nextAnn.shape, cappedFrame);
          if (!nearest) return;

          driver.command.call("annotation.keyframe_add", {
            annotationId: nextAnn.id,
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
