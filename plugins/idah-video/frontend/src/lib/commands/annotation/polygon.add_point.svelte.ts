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
import { VIDEO_POLYGON } from "$lib/types";
import { noopAction } from "..";
import { viewport } from "$lib/state/viewport.svelte";

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
      const props = opts as unknown as PolygonAddPointProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props) return noopAction(command);

      const point = props.point;
      // Snapshot the exact before-state at action creation time,
      // so do/undo are idempotent and independent of _draftPoints at call time.
      const snapshotBefore = [..._draftPoints];
      const snapshotFrame = viewport.video.currentFrame.value;

      return {
        command: { ...command },
        do() {
          _draftPoints = [...snapshotBefore, point];
          viewport.video.currentFrame.value = snapshotFrame;
          driver.setMode(VIDEO_POLYGON);
        },
        undo() {
          _draftPoints = snapshotBefore;
          viewport.video.currentFrame.value = snapshotFrame;
          driver.setMode(VIDEO_POLYGON);
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
