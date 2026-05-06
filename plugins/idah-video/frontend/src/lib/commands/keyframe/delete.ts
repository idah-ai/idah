// ---------------------------------------------------------------------------
// keyframe.delete — Remove a keyframe from an annotation
// Undoable: restores the keyframe.
//
// Usage:
//   driver.command.call("keyframe.delete", { annotationId: "...", frame: 42 });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2, IVideoFrameSelection } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "keyframe.delete",
  modes: [] as string[],
  shortcut: null as [string | null, string] | null,
  shortDescription: null,
  longDescription: null,
};

export interface KeyframeDeleteProps {
  annotationId: string;
  frame: number;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as KeyframeDeleteProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === props.annotationId);
      if (!record) return noopAction(command);

      const frames = (record.shape.frames as IVideoFrameSelection[]) ?? [];
      const idx = frames.findIndex((f) => f.frame === props.frame);
      if (idx === -1) return noopAction(command);

      const snapshot: AnnotationItem = { ...record, shape: { ...record.shape, frames: [...frames] } };

      return {
        command: { ...command },
        async do() {
          const newFrames = frames.filter((f) => f.frame !== props.frame);
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
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
  );
}
