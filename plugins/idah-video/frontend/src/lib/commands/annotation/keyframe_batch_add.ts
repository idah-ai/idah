// ---------------------------------------------------------------------------
// idah-video:annotation.keyframe.batch-add — Add/update keyframes on MULTIPLE
// annotations as a SINGLE undoable action (multi-shape drag).
//
// This command receives pre-captured snapshots (taken before any store
// mutation) so undo restores every annotation's original position in one
// Ctrl+Z, regardless of the anti-blink synchronous upsert that ran before
// this command was dispatched.
//
// Usage:
//   driver.command.call("idah-video:annotation.keyframe.batch-add", {
//     updates: [
//       {
//         annotationId: "...",
//         selection: { frame, angle, points },
//         snapshot: { ... , shape: { frames: [...] } }  // pre-move state
//       },
//       ...
//     ]
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoAnnotationShape, IVideoFrameSelection } from "$lib/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { viewport } from "$lib/state/viewport.svelte";

export const command = {
  name: "idah-video:annotation.keyframe.batch-add",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface KeyframeBatchAddProps {
  updates: Array<{
    annotationId: string;
    selection: IVideoFrameSelection;
    /** Pre-move snapshot captured BEFORE the local store was mutated by the anti-blink upsert. */
    snapshot: AnnotationItem;
  }>;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as KeyframeBatchAddProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props?.updates?.length || !data.annotations) return noopAction(command);

      // Use the provided snapshots — they were captured by the caller BEFORE
      // any store mutation, so undo correctly restores the original positions.
      const updates = props.updates.filter((u) => u?.snapshot);
      if (updates.length === 0) return noopAction(command);

      // If points are empty, interpolate from surrounding keyframes
      // (same semantics as keyframe.add).
      const resolvedUpdates = updates
        .map((u): { annotationId: string; selection: IVideoFrameSelection; snapshot: AnnotationItem } | null => {
          let selection = { ...u.selection };
          if (!selection.points || selection.points.length === 0) {
            const existingShape = u.snapshot.shape as IVideoAnnotationShape;
            const result = getInterpolatedFrame(existingShape, selection.frame);
            if (result) {
              selection = { ...selection, angle: result.angle, points: result.points ?? [] };
            }
          }
          return { annotationId: u.annotationId, selection, snapshot: u.snapshot };
        })
        .filter((u): u is { annotationId: string; selection: IVideoFrameSelection; snapshot: AnnotationItem } => u !== null);

      if (resolvedUpdates.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          // Apply every update — one keyframe write per annotation.
          for (const u of resolvedUpdates) {
            const frames = [...((u.snapshot.shape.frames as IVideoFrameSelection[]) ?? [])];
            const existing = frames.findIndex((f) => f.frame === u.selection.frame);
            if (existing >= 0) frames[existing] = u.selection;
            else frames.push(u.selection);
            frames.sort((a, b) => a.frame - b.frame);

            const min = frames.reduce((m, f) => Math.min(m, f.frame), Infinity);
            const max = frames.reduce((m, f) => Math.max(m, f.frame), -Infinity);

            await data.annotations!.update({
              ...u.snapshot,
              shape: { ...u.snapshot.shape, start: min, end: max, frames },
            });
          }
          viewport.video.currentFrame.value =
            resolvedUpdates[0]?.selection.frame ?? viewport.video.currentFrame.value;
        },
        async undo() {
          if (!data.annotations) return;
          // Restore every snapshot — ALL shapes return to their pre-move
          // position in a single undo step.
          for (const u of resolvedUpdates) {
            await data.annotations.update(u.snapshot);
          }
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      };
    },
    group: command.group,
  });
}