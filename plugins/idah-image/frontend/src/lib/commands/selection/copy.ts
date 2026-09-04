// ---------------------------------------------------------------------------
// idah-image:selection.copy — Copy selected annotations into clipboard
//
// Stores the shape, value, metadata, and group structure of every selected
// annotation so they can be pasted with the same category, shape
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { clipboard } from "$lib/state/clipboard.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "idah-image:selection.copy",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Control+C",
  shortDescription: "Copy selected annotations",
  longDescription: "Copy selected annotations to the clipboard",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);

      return {
        command: { ...command },
        do() {
          const all = data.annotations?.items ?? [];
          if (all.length === 0) return;

          // Collect the selected annotations (from both annotation IDs and group IDs)
          const selectedIds = new Set(selection.selectedAnnotationIds);

          // Collect all annotations from the selected groups
          const copySet = new Set<string>();
          const entries: {
            shape: Record<string, unknown>;
            value: Record<string, unknown> | undefined;
            metadata: Record<string, unknown> | undefined;
            centroidOffset: [number, number];
          }[] = [];

          for (const ann of all) {
            if (selectedIds.has(ann.id) && !copySet.has(ann.id)) {
              copySet.add(ann.id);
              entries.push({
                shape: { ...(ann.shape as any) },
                value: ann.value ? { ...(ann.value as any) } : undefined,
                metadata: ann.metadata ? { ...(ann.metadata as any) } : undefined,
                centroidOffset: [0, 0], // computed below
                // groupId: gid,
              });
            }
          }

          if (entries.length === 0) return;

          // Compute centroid of all annotations' interpolated points at the current frame
          let cx = 0, cy = 0, count = 0;

          for (const entry of entries) {
            const shapes = entry.shape as any;
            // if (!frames?.length) continue;
            // Find the interpolated frame (use frames[0] as approximation)
            const pts = shapes?.points as [number, number][] | undefined;
            if (!pts?.length) continue;
            for (const [px, py] of pts) { cx += px; cy += py; count++; }
          }

          if (count === 0) return;
          const centroid: [number, number] = [cx / count, cy / count];

          // Compute centroid-relative offset for each entry
          for (const entry of entries) {
            const shapes = entry.shape as any;
            const pts = shapes?.points as [number, number][] | undefined;
            if (pts?.length) {
              const ex = pts.reduce((s, p) => s + p[0], 0) / pts.length;
              const ey = pts.reduce((s, p) => s + p[1], 0) / pts.length;
              entry.centroidOffset = [ex - centroid[0], ey - centroid[1]];
            }
          }

          // Store in clipboard
          clipboard.store(entries, centroid);
        },
        isCombinable() { return false; },
        combine(p: never) { return p; },
      };
    },
  });
}
