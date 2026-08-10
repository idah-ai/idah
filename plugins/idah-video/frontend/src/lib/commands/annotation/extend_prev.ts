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
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "annotation.extend_prev",
  group: "Annotation",
  modes: ["editor"],
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
      if (!isEditable()) return noopAction(command);

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
          // ── Resolve target frame ────────────────────────────────────
          const frame = (opts?.frame as number | undefined) ?? viewport.video.currentFrame.value;
          const all = data.annotations?.items ?? [];

          // ── Determine which annotations to process ──────────────────
          let groupIds = new Set<string>();
          let explicitTargets: { id: string; shape: any }[] | null = null;

          if (opts?.annotationId) {
            // Context menu: process that annotation only
            const annotationId = opts.annotationId as string;
            const target = all.find((a) => a.id === annotationId);
            if (!target || annotation.isLocked(target)) return;
            const gid = (target.metadata as any)?.group_id ?? annotationId;
            explicitTargets = all
              .filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid)
              .map((a) => ({ id: a.id, shape: a.shape as any }));
          } else {
            // Shortcut path: use selected annotations/groups
            // Collect all selected annotation IDs + all annotations from selected groups
            const selectedIds = new Set<string>(selection.selectedAnnotationIds);
            const selectedGids = new Set<string>(selection.selectedGroupIds);

            // If no selection but a single group, fallback to group selection behavior
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

            // Resolve group IDs from selected annotations
            for (const ann of all) {
              if (selectedIds.has(ann.id)) {
                groupIds.add((ann.metadata as any)?.group_id ?? ann.id);
              }
            }
            // Add selected groups directly
            for (const gid of selectedGids) groupIds.add(gid);

            // If any selected group is locked, abort
            for (const gid of groupIds) {
              if (annotation.isLocked(gid)) return;
            }
          }

          // ── For each group (or explicit target), find previous annotation and extend ──
          const groupsToProcess: { id: string; shape: any }[][] =
            explicitTargets !== null
              ? [explicitTargets]
              : Array.from(groupIds).map((gid) =>
                  all
                    .filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid)
                    .map((a) => ({ id: a.id, shape: a.shape as any })),
                );

          for (const groupAnnotations of groupsToProcess) {
            if (groupAnnotations.length === 0) continue;

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

            if (!prevAnn) continue;

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