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
import type { IAnnotationRecord, IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IVideoAnnotationShape, IVideoFrameSelection } from "$lib/types";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import { noopAction } from "..";

export const command = {
  name: "annotation.split",
  group: "Annotation",
  modes: ["default", "review"] as string[],
  shortcut: "S",
  shortDescription: "Split annotation at frame",
  longDescription: null,
};

export interface AnnotationSplitProps {
  annotationId: string;
  at: number;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      // Derive annotationId + at from opts (programmatic call) or from current selection (shortcut invocation)
      let annotationId: string | undefined;
      let at: number | undefined;

      if (opts) {
        const props = opts as unknown as AnnotationSplitProps;
        annotationId = props.annotationId;
        at = props.at;
      } else {
        // Shortcut invocation — derive from current selection and viewport
        if (selection.hasSelection() && selection.isAnnotation()) {
          const sel = selection.value as {
            type: "annotation";
            annotation: IAnnotationRecord<Record<string, unknown>, Record<string, unknown>>;
          };

          annotationId = sel.annotation.id;
          at = viewport.video.currentFrame.value;
        }
      }

      if (!annotationId || at === undefined || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === annotationId);
      if (!record) return noopAction(command);

      const shape = record.shape as IVideoAnnotationShape;
      const frames = (shape.frames ?? []) as IVideoFrameSelection[];

      // Splitting at frame zero is not possible — nothing to split off.
      if (at <= 0) return noopAction(command);

      const splitAt = at - 1; // split between splitAt and splitAt+1

      // Ensure there is a keyframe at the split point.
      // If none exists, interpolate one from the surrounding keyframes.
      let splitFrame: IVideoFrameSelection | undefined = frames.find((f) => f.frame === splitAt);
      if (!splitFrame) {
        const interpolated = getInterpolatedFrame(shape, splitAt);
        if (interpolated) {
          splitFrame = { frame: splitAt, angle: interpolated.angle, points: interpolated.points ?? [] };
        }
      }

      if (!splitFrame) return noopAction(command);

      // Left side: keyframes ≤ splitAt, ends at splitAt
      // Right side: keyframes ≥ splitAt+1, starts at splitAt+1
      let leftFrames = frames.filter((f) => f.frame <= splitAt);
      let rightFrames = frames.filter((f) => f.frame >= at);

      // Ensure the split frame is in the left set, and the right set starts fresh
      if (!leftFrames.find((f) => f.frame === splitAt)) leftFrames.push(splitFrame);
      if (!rightFrames.find((f) => f.frame === at)) {
        // Clone the split frame at the new start position for the right side
        rightFrames.unshift({ ...splitFrame, frame: at });
      }

      leftFrames.sort((a, b) => a.frame - b.frame);
      rightFrames.sort((a, b) => a.frame - b.frame);

      const leftMin = leftFrames[0].frame;
      const leftMax = leftFrames[leftFrames.length - 1].frame;
      const rightMin = rightFrames[0].frame;
      const rightMax = rightFrames[rightFrames.length - 1].frame;

      let _createdRightId: string | undefined;

      return {
        command: { ...command },
        async do() {
          // Update original annotation to left part (start → at)
          await data.annotations!.update({
            ...record,
            shape: {
              ...shape,
              start: leftMin,
              end: leftMax,
              frames: leftFrames,
            },
          });

          // Derive a group id from the original annotation so both parts
          // stay in the same timeline group.
          const groupId = (record.metadata?.group_id ?? record.id) as string;

          // Create a new annotation for the right part (at → end)
          const created = (await (data.annotations!.create as any)({
            shape: {
              ...shape,
              start: rightMin,
              end: rightMax,
              frames: rightFrames,
            },
            value: record.value ? { ...record.value } : undefined,
            metadata: { group_id: groupId },
          })) as AnnotationItem;
          _createdRightId = created.id;
        },
        async undo() {
          if (!data.annotations) return;
          // Restore original annotation
          await data.annotations.update(record);
          // Delete the right part using the stored id
          if (_createdRightId) await data.annotations.delete(_createdRightId);
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
    activeWhen: selection.hasSelection,
  });
}
