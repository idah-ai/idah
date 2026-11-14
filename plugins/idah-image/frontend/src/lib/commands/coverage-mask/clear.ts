// ---------------------------------------------------------------------------
// coverage-mask/clear — Remove all mask shapes (shortcut Ctrl+Shift+K, undoable)
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE, COVERAGE_DONE_AREA } from "$lib/types";
import { session } from "$lib/mask/coverage-mask-session";
import { flushDirtyTiles } from "$lib/mask/flush-tiles";
import { doOff, invalidate } from "./_shared";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "coverage-mask-clear",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE, ] as string[],
  shortcut: "Control+Shift+K" as string | null,
  shortDescription: "Done Area — Clear all",
  longDescription: "Remove all coverage mask shapes",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) {
        return {
          command: { ...command },
          do() {},
          isCombinable() { return false; },
          combine(p) { return p; },
        };
      }
      const beforeSnapshots = session.snapshotAll();
      const existingId = data.annotations?.items?.find(a => a.shape_type === COVERAGE_DONE_AREA)?.id;
      return {
        command: { ...command },
        async do() {
          doOff();
          invalidate(driver);
          if (!existingId) return;
          const ann = data.annotations?.items.find(a => a.id === existingId);
          if (ann?.shape_args) {
            const tileKeys: Array<{ key: string; value: null }> = [];
            for (const key of Object.keys(ann.shape_args as Record<string, unknown>)) {
              if (key.startsWith("tile-")) tileKeys.push({ key, value: null });
            }
            if (tileKeys.length > 0) {
              await data.annotations!.setShapes(ann.id, tileKeys);
            }
          }
          session.reset();
          await data.annotations!.delete(existingId);
        },
        async undo() {
          if (!existingId) return;
          // Restore the soft-deleted annotation
          const restored = await data.annotations!.restore({
            id: existingId,
            shape_type: COVERAGE_DONE_AREA,
            category: "done_area",
            shape_args: {},
            properties: {},
          } as any);
          // Restore tile buffers and flush
          session.restoreSnapshots(beforeSnapshots);
          const dirty = session.getDirtyTiles();
          if (dirty.length > 0) {
            await flushDirtyTiles(
              restored.id,
              dirty,
              (col, row) => session.getTileBuffer(col, row),
              (id, key, value) => data.annotations!.setShape(id, key, value),
              (id, entries) => data.annotations!.setShapes(id, entries),
            );
          }
          invalidate(driver);
        },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}