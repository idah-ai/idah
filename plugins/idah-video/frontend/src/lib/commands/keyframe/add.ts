// ---------------------------------------------------------------------------
// keyframe.add — Add a keyframe to an annotation
// Undoable: removes the keyframe.
//
// Usage:
//   driver.command.call("keyframe.add", {
//     annotationId: "...", selection: { frame, angle, points }
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoFrameSelection } from "$idah/v2/video-types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "keyframe.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null,
  longDescription: null,
};

export interface KeyframeAddProps {
  annotationId: string;
  selection: IVideoFrameSelection;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as KeyframeAddProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === props.annotationId);
      if (!record) return noopAction(command);

      const snapshot: AnnotationItem = { ...record, shape: { ...record.shape, frames: [...((record.shape.frames as any[]) ?? [])] } };

      return {
        command: { ...command },
        async do() {
          const frames = [...((snapshot.shape.frames as IVideoFrameSelection[]) ?? [])];
          const existing = frames.findIndex((f) => f.frame === props.selection.frame);
          if (existing >= 0) frames[existing] = props.selection;
          else frames.push(props.selection);
          frames.sort((a, b) => a.frame - b.frame);

          const min = frames.reduce((m, f) => Math.min(m, f.frame), Infinity);
          const max = frames.reduce((m, f) => Math.max(m, f.frame), -Infinity);

          await data.annotations!.update({
            ...snapshot,
            shape: { ...snapshot.shape, start: min, end: max, frames },
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
    command.group,
  );
}
