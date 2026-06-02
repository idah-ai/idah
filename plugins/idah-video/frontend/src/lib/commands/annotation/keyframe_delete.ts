// ---------------------------------------------------------------------------
// annotation.keyframe_delete — Remove a keyframe from an annotation
// Undoable: restores the keyframe.
//
// Usage:
//   driver.command.call("annotation.keyframe_delete", { annotationId: "...", frame: 42 });
//
// Shortcut: Delete
// Active only when there's a selected annotation and the current frame
// is a keyframe of that annotation.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoFrameSelection } from "$lib/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "annotation.keyframe_delete",
  group: "Annotation",
  modes: ["default", "review"],
  shortcut: "Control+Delete",
  shortDescription: "Delete keyframe",
  longDescription: "Remove the selected keyframe from the annotation",
};

export interface KeyframeDeleteProps {
  annotationId: string;
  frame: number;
}

function isCurrentFrameKeyframe(): boolean {
  const sel = selection.value;
  if (!sel || sel.type !== "annotation") return false;
  const frames = (sel.annotation.shape?.frames as IVideoFrameSelection[]) ?? [];
  const currentFrame = viewport.video.currentFrame.value;
  return frames.some((f) => f.frame === currentFrame);
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      if (!isEditable()) return noopAction(command);

      // Derive annotationId + frame from opts (programmatic call) or from current selection (shortcut invocation)
      let annotationId: string | undefined;
      let frame: number | undefined;

      if (opts) {
        const props = opts as unknown as KeyframeDeleteProps;
        annotationId = props.annotationId;
        frame = props.frame;
      } else {
        // Shortcut invocation — derive from current selection and viewport
        const sel = selection.value;
        if (sel && sel.type === "annotation") {
          annotationId = sel.annotation.id;
          frame = viewport.video.currentFrame.value;
        }
      }

      if (!annotationId || frame === undefined || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === annotationId);
      if (!record) return noopAction(command);

      const frames = (record.shape.frames as IVideoFrameSelection[]) ?? [];
      const idx = frames.findIndex((f) => f.frame === frame);
      if (idx === -1) return noopAction(command);

      const snapshot: AnnotationItem = { ...record, shape: { ...record.shape, frames: [...frames] } };

      return {
        command: { ...command },
        async do() {
          const newFrames = frames.filter((f) => f.frame !== frame);
          const min = newFrames.length > 0 ? newFrames.reduce((m, f) => Math.min(m, f.frame), Infinity) : 0;
          const max = newFrames.length > 0 ? newFrames.reduce((m, f) => Math.max(m, f.frame), -Infinity) : 0;

          await data.annotations!.update({
            ...snapshot,
            shape: { ...snapshot.shape, start: min, end: max, frames: newFrames },
          });
        },
        async undo() {
          if (!data.annotations) return;
          await data.annotations.update(snapshot);
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
    activeWhen: isCurrentFrameKeyframe,
  });
}
