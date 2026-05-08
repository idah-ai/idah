// ---------------------------------------------------------------------------
// annotation.polygon.add — Finalize a polygon annotation
// Undoable: deletes the created annotation.
//
// Usage:
//   driver.command.call("annotation.polygon.add", {
//     points: [[0.1,0.2],[0.3,0.4],[0.5,0.6]], start: 1, end: 100
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";

export const command = {
  name: "annotation.polygon.add",
  modes: [] as string[],
  shortcut: null as [string | null, string] | null,
  shortDescription: null,
  longDescription: null,
};

export interface PolygonAddProps {
  points: [number, number][];
  value?: { category?: string; label?: string; [key: string]: unknown };
  start: number;
  end: number;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as PolygonAddProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      const frameSelection = {
        frame: props.start,
        angle: 0,
        points: props.points,
      };

      return {
        command: { ...command },
        async do() {
          const created = await data.annotations!.create({
            shape: {
              type: "idah-video:polygon",
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
  );
}
