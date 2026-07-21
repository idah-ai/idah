// -------------------------------------------------------------------------------
// annotation.mask_shapes.flush — Flush mask session buffer to backend
//
// Only writes tiles to an existing annotation.  The annotation must already
// exist (created via the standard annotation.add flow through onSelection).
// Does NOT create the annotation itself — that's the parent workspace's job.
//
// The annotation ID is resolved from:
//   1. maskSession.annotationId (set by brush tool when painting on existing)
//   2. The currently selected annotation, if its type is IMAGE_MASK
//
// Undo restores the prior tile state for each dirty tile key.
// -------------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";
import { maskSession } from "$lib/state/mask-session.svelte";
import { IMAGE_MASK } from "$lib/types";
import { flushDirtyTiles } from "$lib/mask/flush-tiles";
import { encode, decode } from "$lib/mask/rle";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { isEmpty } from "$lib/mask/raster";
import { invalidate } from "$lib/mask/tile-cache";
import { isEditable } from "$lib/state/editor.svelte";
import { noopAction } from "..";
import { selection } from "$lib/state/selection.svelte";

export const command = {
  name: "annotation.mask_shapes.flush",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Flush mask paint",
  longDescription: null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);
      if (!data.annotations) return noopAction(command);

      const dirtyTiles = maskSession.getDirtyTiles();
      if (dirtyTiles.length === 0) return noopAction(command);

      // Resolve the annotation ID: session > selected mask annotation
      const sessAnnId = maskSession.annotationId;
      const selAnnId = !sessAnnId ? (() => {
        const sel = selection.value;
        return sel && (sel.shape as any)?.type === IMAGE_MASK ? sel.id : undefined;
      })() : undefined;

      const annotationId = sessAnnId ?? selAnnId;
      if (!annotationId) return noopAction(command);

      // Snapshot current tile state for undo — capture the actual RLE values
      // from the backend (via the local store's shape data) BEFORE the flush
      // overwrites them. This ensures undo can restore the exact prior state
      // rather than just clearing tiles.
      // NOTE: dirtyTiles use "col:row" format internally, but the annotation
      // shape store uses "tile-colxrow" keys. Convert accordingly.
      const snapshot = new Map<string, object | null>();
      const existingRecord = data.annotations.items.find((a) => a.id === annotationId);
      if (existingRecord) {
        for (const tileKey of dirtyTiles) {
          const [colStr, rowStr] = tileKey.split(":");
          const shapeKey = `tile-${colStr}x${rowStr}`;
          const existingValue = (existingRecord.shape as Record<string, unknown>)[shapeKey];
          snapshot.set(tileKey, existingValue !== undefined ? (existingValue as object) : null);
        }
      }

      // Also snapshot the NEW RLE values (what will be written) so undo can
      // re-snapshot if the command is re-done after an undo.
      const newSnapshot = new Map<string, object | null>();
      for (const tileKey of dirtyTiles) {
        const [colStr, rowStr] = tileKey.split(":");
        const col = parseInt(colStr, 10);
        const row = parseInt(rowStr, 10);
        const buf = maskSession.getTileBuffer(col, row);
        if (buf) {
          if (isEmpty(buf)) {
            newSnapshot.set(tileKey, null);
          } else {
            const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
            newSnapshot.set(tileKey, { rle });
          }
        }
      }

      return {
        command: { ...command },

        async do() {
          await flushDirtyTiles(
            annotationId,
            dirtyTiles,
            (col, row) => {
              // For do(), read from the newSnapshot (pre-computed at callback time)
              const key = `${col}:${row}`;
              const val = newSnapshot.get(key);
              if (val === null) return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE); // empty
              if (val && typeof val === 'object' && 'rle' in val) {
                return decode((val as { rle: string }).rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
              }
              return undefined;
            },
            (annId, key, value) => data.annotations!.setShape(annId, key, value),
          );
          maskSession.reset();
        },

        async undo() {
          if (!data.annotations) return;
          for (const tileKey of dirtyTiles) {
            const [colStr, rowStr] = tileKey.split(":");
            const col = parseInt(colStr, 10);
            const row = parseInt(rowStr, 10);
            const tileKeyStr = `tile-${col}x${row}`;
            const priorValue = snapshot.get(tileKey) ?? null;
            await data.annotations!.setShape(annotationId, tileKeyStr, priorValue);
            // Invalidate the cached bitmap — the tile's value changed back
            invalidate(annotationId, tileKey);
          }
        },

        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
