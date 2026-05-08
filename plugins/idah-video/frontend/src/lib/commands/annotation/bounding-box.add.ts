// ---------------------------------------------------------------------------
// annotation.bounding_box.add — Create a new bounding box annotation
// Undoable: deletes the created annotation.
//
// Usage:
//   driver.command.call("annotation.bounding_box.add", {
//     points: [[0.1,0.2],[0.3,0.4]], start: 1, end: 100, value: { category: "car" }
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";

export const command = {
  name: "annotation.bounding_box.add",
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null,
  longDescription: null,
};

export interface BoundingBoxAddProps {
  aabb: [number, number, number, number];
  angle?: number;
  value?: { category?: string; label?: string; [key: string]: unknown };
  start: number;
  end: number;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as BoundingBoxAddProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      const frameSelection = {
        frame: props.start,
        angle: props.angle ?? 0,
        aabb: props.aabb,
      };

      return {
        command: { ...command },
        async do() {
          const created = await data.annotations!.create({
            shape: {
              type: "idah-video:bounding-box",
              start: props.start,
              end: props.end,
              frames: [frameSelection],
            },
            value: props.value,
          });
          (this as any)._createdId = created.id;
        },
        async undo() {
          const id = (this as any)._createdId;
          if (id && data.annotations) {
            await data.annotations.delete(id);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    command.group,
  );
}
