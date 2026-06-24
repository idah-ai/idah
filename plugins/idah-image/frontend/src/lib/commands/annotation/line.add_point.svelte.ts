// ---------------------------------------------------------------------------
// annotation.line.add_point — Place a point for the line being drawn
// Undoable: removes the last placed point.
//
// Usage:
//   driver.command.call("annotation.line.add_point", { point: [0.5, 0.3] });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";

export const command = {
  name: "annotation.line.add_point",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface LineAddPointProps {
  point: [number, number];
}

/** In-memory buffer of points (max 2) for the current line drawing session. */
let _draftPoints: [number, number][] = $state([]);

export const lineDraft = {
  get points() { return _draftPoints; },
  reset() { _draftPoints = []; },
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as LineAddPointProps | undefined;
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
