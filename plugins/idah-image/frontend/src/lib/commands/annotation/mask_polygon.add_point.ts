// ---------------------------------------------------------------------------
// annotation.mask_polygon.add_point — Add a vertex to the mask polygon being drawn
// Undoable: removes the last vertex.
// Combinable: multiple point adds in a short window merge into one step.
//
// Usage:
//   driver.command.call("annotation.mask_polygon.add_point", { point: [0.5, 0.3] });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { isEditable } from "$lib/state/editor.svelte";
import { IMAGE_MASK } from "$lib/types";
import { noopAction } from "..";
import { maskPolygonDraft } from "$lib/commands/mode/mask_polygon";
import { maskTool } from "$lib/state/mask-tool.svelte";
import { maskSession } from "$lib/state/mask-session.svelte";

export const command = {
  name: "annotation.mask_polygon.add_point",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface MaskPolygonAddPointProps {
  point: [number, number];
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as MaskPolygonAddPointProps | undefined;
      if (!props) return noopAction(command);

      if (!isEditable()) return noopAction(command);

      const point = props.point;
      // Snapshot the exact before-state at action creation time,
      // so do/undo are idempotent and independent of maskPolygonDraft.points at call time.
      const snapshotBefore = [...maskPolygonDraft.points];
      const snapshotMode = maskSession.mode;

      return {
        command: { ...command },
        do() {
          driver.setMode(IMAGE_MASK);
          maskTool.active = "polygon";
          maskSession.setMode(snapshotMode);
          maskPolygonDraft.points = [...snapshotBefore, point];
        },
        undo() {
          driver.setMode(IMAGE_MASK);
          maskTool.active = "polygon";
          maskSession.setMode(snapshotMode);
          maskPolygonDraft.points = snapshotBefore;
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