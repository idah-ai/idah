// ---------------------------------------------------------------------------
// annotation.line.add_point — Place a point for the line being drawn
// Undoable: removes the last placed point.
//
// Usage:
//   driver.command.call("annotation.line.add_point", { point: [0.5, 0.3] });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { IMAGE_LINE } from "$lib/types";
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
  set points(val: [number, number][]) { _draftPoints = val; },
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
      // Snapshot the exact before-state at action creation time,
      // so do/undo are idempotent and independent of _draftPoints at call time.
      const snapshotBefore = [..._draftPoints];

      return {
        command: { ...command },
        do() {
          driver.setMode(IMAGE_LINE)
          _draftPoints = [...snapshotBefore, point];
        },
        undo() {
          driver.setMode(IMAGE_LINE)
          _draftPoints = snapshotBefore;
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
