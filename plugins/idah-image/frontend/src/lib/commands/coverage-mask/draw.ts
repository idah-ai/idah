// ---------------------------------------------------------------------------
// coverage-mask/draw — Undoable mask shape draw/erase (called by ShapesContainer)
//
// Receives rect + mode from ShapesContainer, paints into session, and
// snapshots tiles beforehand for undo/redo support.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE, COVERAGE_DONE_AREA } from "$lib/types";
import { session } from "$lib/mask/coverage-mask-session";
import { flushDirtyTiles } from "$lib/mask/flush-tiles";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "coverage-mask-draw",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE] as string[],
  shortcut: null as string | null,
  shortDescription: null as string | null,
  longDescription: null as string | null,
};

/**
 * Build tile entries, then create annotation if needed and flush.
 *
 * IMPORTANT: Tile buffers are cached BEFORE the annotation is created
 * because create() triggers a ShapesContainer $effect that calls
 * session.initFromRle() which clears the tile buffers. By caching them
 * first, flushDirtyTiles can read from the cache instead.
 */
async function flushIfDirty(): Promise<void> {
  const dirty = session.getDirtyTiles();
  if (dirty.length === 0) return;

  // Cache tile buffers before any async operation that may clear them
  const _bufferCache = new Map<string, Uint8Array>();
  for (const key of dirty) {
    const [c, r] = key.split(":").map(Number);
    const buf = session.getTileBuffer(c, r);
    if (buf) _bufferCache.set(key, buf);
  }

  let ann = data.annotations?.items.find(a => a.shape_type === COVERAGE_DONE_AREA);
  if (!ann) {
    ann = await data.annotations!.create({
      shape_type: COVERAGE_DONE_AREA,
      category: "done_area",
      shape_args: {},
      resource: getDriver()?.media?.resource,
    });
  }

  await flushDirtyTiles(
    ann.id,
    dirty,
    (col, row) => _bufferCache.get(`${col}:${row}`) ?? session.getTileBuffer(col, row),
    (id, key, value) => data.annotations!.setShape(id, key, value),
    (id, entries) => data.annotations!.setShapes(id, entries),
  );
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts) => {
      if (!isEditable()) {
        return {
          command: { ...command },
          do() {},
          isCombinable() { return false; },
          combine(p) { return p; },
        };
      }

      return {
      command: { ...command },
      async do() {
        const t0 = performance.now();
        const { rect, mode } = opts ?? {};
        if (rect && mode) session.fillRect(rect[0], rect[1], rect[2], rect[3], mode as any);
        const t1 = performance.now();
        await flushIfDirty();
        const t2 = performance.now();
      },
      async undo() {
        const { tileSnapshots } = opts ?? {};
        if (tileSnapshots) session.restoreSnapshots(tileSnapshots as any);
        await flushIfDirty();
      },
      isCombinable() { return false; },
      combine(p: any) { return p; },
    }},
    group: command.group,
  });
}
