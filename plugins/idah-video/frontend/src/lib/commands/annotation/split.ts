// ---------------------------------------------------------------------------
// annotation.split — Split an annotation at a given frame
//
// Creates two annotations from one: the first runs from the original start
// to the split frame, the second from the split frame to the original end.
// Both inherit the original keyframes on their respective sides.
// The split annotation keeps the same metadata (group_id) so it stays
// in the same timeline group.
// Undoable: deletes the two new annotations and restores the original.
//
// Usage:
//   driver.command.call("annotation.split", { annotationId: "...", at: 42 });
//
// Shortcut: S
// Active only when there's a selected annotation.
// ---------------------------------------------------------------------------
import { uuidv7 } from "uuidv7";

import type { IAnnotationRecord, IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { selection, type IAnnotationSelection } from "$lib/state/selection.svelte";
import { annotation } from "$lib/state/annotation.svelte";

import type { IVideoAnnotationShape, IVideoFrameSelection } from "$lib/types";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "annotation.split",
  group: "Annotation",
  modes: ["editor"] as string[],
  shortcut: "S",
  shortDescription: "Split annotation at frame",
  longDescription: null,
};

export interface AnnotationSplitProps {
  annotationId: string;
  at: number;
}

export function register(driver: IIdahDriverV2, getCurrentFrame?: () => number): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      if (!isEditable()) return noopAction(command);

      // ── Resolve which annotations to split ──────────────────────────
      interface SplitTarget {
        record: AnnotationItem;
        shape: IVideoAnnotationShape;
        frames: IVideoFrameSelection[];
        at: number;
        rightId: string;
        leftFrames: IVideoFrameSelection[];
        rightFrames: IVideoFrameSelection[];
        leftMin: number; leftMax: number;
        rightMin: number; rightMax: number;
      }

      const targets: SplitTarget[] = [];
      const all = data.annotations?.items ?? [];

      if (opts?.annotationId) {
        // Context menu / programmatic: single annotation
        const props = opts as unknown as AnnotationSplitProps;
        const record = all.find((r) => r.id === props.annotationId) as AnnotationItem | undefined;
        if (!record) return noopAction(command);
        const shape = record.shape as IVideoAnnotationShape;
        const at = props.at;
        if (at <= 0) return noopAction(command);
        const splitAt = at - 1;
        const frames = (shape.frames ?? []) as IVideoFrameSelection[];
        const splitFrame = ensureSplitFrame(shape, frames, splitAt);
        if (!splitFrame) return noopAction(command);
        const { leftFrames, rightFrames, leftMin, leftMax, rightMin, rightMax } = buildSplitFrames(frames, splitFrame, splitAt, at);
        targets.push({ record, shape, frames, at, rightId: uuidv7(), leftFrames, rightFrames, leftMin, leftMax, rightMin, rightMax });
      } else {

        // Batch: use opts.at if provided, otherwise fall back to injected getter
        const at = (opts?.at != null ? (opts.at as number) : (getCurrentFrame?.() ?? 0));
        if (at <= 0) return noopAction(command);

        const selectedIds = new Set(selection.selectedAnnotationIds);

        // Fallback to single-selection behavior
        if (selectedIds.size === 0) {
          const sel = selection.value;
          if (!sel) return noopAction(command);
          if (sel.type === "annotation") {
            selectedIds.add(sel.annotation.id);
          } else {
            return noopAction(command);
          }
        }

        // Collect all target annotations
        const targetRecords: AnnotationItem[] = [];
        for (const ann of all) {
          if (selectedIds.has(ann.id)) {
            targetRecords.push(ann as AnnotationItem);
          }
        }

        for (const record of targetRecords) {
          if (annotation.isLocked(record)) continue;
          const shape = record.shape as IVideoAnnotationShape;
          if (shape.start > at || shape.end < at) continue;
          const splitAt = at - 1;
          const frames = (shape.frames ?? []) as IVideoFrameSelection[];
          const splitFrame = ensureSplitFrame(shape, frames, splitAt);
          if (!splitFrame) continue;
          const { leftFrames, rightFrames, leftMin, leftMax, rightMin, rightMax } = buildSplitFrames(frames, splitFrame, splitAt, at);
          targets.push({ record, shape, frames, at, rightId: uuidv7(), leftFrames, rightFrames, leftMin, leftMax, rightMin, rightMax });
        }
      }

      if (targets.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          for (const t of targets) {
            // Update original annotation to left part
            await data.annotations!.update({
              ...t.record,
              shape: {
                ...t.shape,
                start: t.leftMin,
                end: t.leftMax,
                frames: t.leftFrames,
              },
            });
            // Create right part
            const groupId = (t.record.metadata?.group_id ?? t.record.id) as string;
            await data.annotations!.create({
              id: t.rightId,
              shape: {
                ...t.shape,
                start: t.rightMin,
                end: t.rightMax,
                frames: t.rightFrames,
              },
              value: t.record.value ? { ...t.record.value } : undefined,
              metadata: { group_id: groupId } as unknown as AnnotationItem["metadata"],
            });
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const t of targets) {
            await data.annotations.update(t.record);
            await data.annotations.delete(t.rightId);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: () => {
      return selection.hasSelection() && !annotation.isLocked((selection.value as any)?.annotation?.id ?? "");
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureSplitFrame(
  shape: IVideoAnnotationShape,
  frames: IVideoFrameSelection[],
  splitAt: number,
): IVideoFrameSelection | undefined {
  let splitFrame = frames.find((f) => f.frame === splitAt);
  if (!splitFrame) {
    const interpolated = getInterpolatedFrame(shape, splitAt);
    if (interpolated) {
      splitFrame = { frame: splitAt, angle: interpolated.angle, points: interpolated.points ?? [] };
    }
  }
  return splitFrame;
}

function buildSplitFrames(
  frames: IVideoFrameSelection[],
  splitFrame: IVideoFrameSelection,
  splitAt: number,
  at: number,
) {
  let leftFrames = frames.filter((f) => f.frame <= splitAt);
  let rightFrames = frames.filter((f) => f.frame >= at);

  if (!leftFrames.find((f) => f.frame === splitAt)) leftFrames.push(splitFrame);
  if (!rightFrames.find((f) => f.frame === at)) {
    rightFrames.unshift({ ...splitFrame, frame: at });
  }

  leftFrames.sort((a, b) => a.frame - b.frame);
  rightFrames.sort((a, b) => a.frame - b.frame);

  return {
    leftFrames,
    rightFrames,
    leftMin: leftFrames[0].frame,
    leftMax: leftFrames[leftFrames.length - 1].frame,
    rightMin: rightFrames[0].frame,
    rightMax: rightFrames[rightFrames.length - 1].frame,
  };
}
