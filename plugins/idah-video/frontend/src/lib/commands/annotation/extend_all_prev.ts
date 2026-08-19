// ---------------------------------------------------------------------------
// annotation.extend_all_prev — Extend the end of ALL selected annotations to a frame
//
// Works on every selected annotation (or all annotations in selected groups).
// For each annotation that ends before the current frame, extends its ending
// frame to the current frame.  Skips annotations that already cover the frame.
//
// Context menu / shortcut usage:
//   driver.command.call("annotation.extend_all_prev", { frame });
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
  name: "annotation.extend_all_prev",
  group: "Annotation",
  modes: ["editor"],
  shortcut: null,
  shortDescription: "Extend all previous annotations",
  longDescription: "Extend every selected annotation that ends before the current frame",
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
          name: "annotation.extend_all_prev",
          group: "Annotation",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          // ── Resolve target frame ────────────────────────────────────
          const frame = (opts?.frame as number | undefined) ?? viewport.video.currentFrame.value;
          const all = data.annotations?.items ?? [];
          if (all.length === 0) return;

          // ── Resolve target annotations ──────────────────────────────
          const selectedIds = new Set<string>(selection.selectedAnnotationIds);
          const selectedGids = new Set<string>(selection.selectedGroupIds);

          // Fallback to single-selection behavior
          if (selectedIds.size === 0 && selectedGids.size === 0) {
            const sel = selection.value;
            if (!sel) return;
            if (sel.type === "group") {
              selectedGids.add(sel.groupId);
            } else if (sel.type === "annotation") {
              selectedIds.add(sel.annotation.id);
            } else {
              return;
            }
          }

          // Collect every selected annotation + annotations in selected groups
          const targets: { id: string; shape: any; groupId: string }[] = [];
          for (const ann of all) {
            const gid = (ann.metadata as any)?.group_id ?? ann.id;
            if (selectedIds.has(ann.id) || selectedGids.has(gid)) {
              targets.push({ id: ann.id, shape: ann.shape as any, groupId: gid });
            }
          }

          if (targets.length === 0) return;

          // If any selected group is locked, abort
          const allGids = new Set(targets.map((t) => t.groupId));
          for (const gid of allGids) {
            if (annotation.isLocked(gid)) return;
          }

          // ── Per-group: find the annotation with the GREATEST end frame before `frame` ──
          // (the one closest to the playhead) and extend only that one.
          const groupsToProcess = new Map<string, typeof targets>();
          for (const t of targets) {
            const g = groupsToProcess.get(t.groupId);
            if (g) g.push(t); else groupsToProcess.set(t.groupId, [t]);
          }

          for (const [, groupAnnotations] of groupsToProcess) {
            // Guard: if an annotation in this group already covers the current
            // frame, there is nothing to extend → skip.
            const hasCovering = groupAnnotations.some((a) => {
              const frames = (a.shape.frames as any[]) ?? [];
              const first = frames.length > 0 ? (frames[0]?.frame as number) ?? Infinity : Infinity;
              const last = frames.length > 0 ? (frames[frames.length - 1]?.frame as number) ?? -1 : -1;
              return first <= frame && last >= frame;
            });
            if (hasCovering) continue;

            // Guard: if the current frame is before the first start of this
            // group, there is nothing to extend the end of → skip.
            const groupFirstStart = groupAnnotations.reduce((best, a) => {
              const frames = (a.shape.frames as any[]) ?? [];
              const first = frames.length > 0 ? (frames[0]?.frame as number) ?? Infinity : Infinity;
              return first < best ? first : best;
            }, Infinity);
            if (frame < groupFirstStart) continue;

            // Find the annotation whose end is closest to but before `frame`
            const prevAnn = groupAnnotations
              .filter((a) => {
                const frames = (a.shape.frames as any[]) ?? [];
                const lastFrame = frames.length > 0 ? (frames[frames.length - 1]?.frame as number) ?? -1 : -1;
                return lastFrame < frame;
              })
              .sort((a, b) => {
                const aFrames = (a.shape.frames as any[]) ?? [];
                const bFrames = (b.shape.frames as any[]) ?? [];
                const aEnd = aFrames.length > 0 ? (aFrames[aFrames.length - 1]?.frame as number) ?? -1 : -1;
                const bEnd = bFrames.length > 0 ? (bFrames[bFrames.length - 1]?.frame as number) ?? -1 : -1;
                return bEnd - aEnd;
              })[0];

            if (!prevAnn) continue;

            // Overlap protection: don't exceed the next annotation's start
            const nextAnn = groupAnnotations
              .filter((a) => {
                const firstFrame = (a.shape.frames as any[])?.[0]?.frame as number ?? Infinity;
                return firstFrame > frame && a.id !== prevAnn.id;
              })
              .sort(
                (a, b) =>
                  ((a.shape.frames as any[])?.[0]?.frame as number ?? Infinity) -
                  ((b.shape.frames as any[])?.[0]?.frame as number ?? Infinity),
              )[0];

            let cappedFrame = frame;
            if (nextAnn) {
              const nextStart = (nextAnn.shape.frames as any[])?.[0]?.frame as number ?? Infinity;
              if (frame >= nextStart) cappedFrame = nextStart - 1;
            }

            const nearest = nearestKeyframe(prevAnn.shape, cappedFrame);
            if (!nearest) continue;

            driver.command.call("annotation.keyframe_add", {
              annotationId: prevAnn.id,
              selection: {
                frame: cappedFrame,
                ...nearest,
              },
            });
          }
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
