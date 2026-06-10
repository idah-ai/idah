// ---------------------------------------------------------------------------
// annotation.polygon.add_point — Add a vertex to the polygon being drawn
// Undoable: removes the last vertex.
// Combinable: multiple point adds in a short window merge into one step.
//
// Usage:
//   driver.command.call("annotation.polygon.add_point", { point: [0.5, 0.3] });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { isEditable } from "$lib/state/editor.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.polygon.add_point",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface PolygonAddPointProps {
  point: [number, number];
}

/** In-memory buffer of points being built for the current polygon drawing session. */
let _draftPoints: [number, number][] = $state([]);

export const draft = {
  get points() {
    return _draftPoints;
  },
  reset() {
    _draftPoints = [];
  },
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as PolygonAddPointProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props) return noopAction(command);

      const point = props.point;

      return {
        command: { ...command },
        do() {
          _draftPoints = [..._draftPoints, point];
        },
        undo() {
          _draftPoints = _draftPoints.slice(0, -1);
        },
        isCombinable(previous) {
          return previous.command.name === command.name;
        },
        combine(previous) {
          return this;
        },
      };
    },
    group: command.group,
  });
}
