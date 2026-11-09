// ---------------------------------------------------------------------------
// coverage-mask/save — Persist coverage mask rectangles to backend as tiles
//
// Coverage masks are stored as pixel mask tiles (tile-{col}x{row}) using
// the same setShape/annotation_shape mechanism as IMAGE_MASK tiles.
// This avoids the shape_args nesting issues of storing rects directly.
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { COVERAGE_DONE_AREA } from "$lib/types";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { decode } from "$lib/mask/rle";
import { isTileKey } from "$lib/mask/strip-tile-keys";
import { buildTileEntries } from "$lib/mask/coverage-mask";
import { writeTileEntries } from "$lib/mask/write-tile-entries";

export const command = {
  name: "coverage-mask-save",
  group: "Coverage Mask",
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null as string | null,
  longDescription: null as string | null,
};

// Track the last annotation soft-deleted via clear-all, so the next draw
// can restore it instead of creating a new one.
let _clearedAnnId: string | null = null;

export function register(driver: IIdahDriverV2): void {
// export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => ({
      command: { ...command },
      async do() {
        const existing = data.annotations?.items.find(a => a.shape_type === COVERAGE_DONE_AREA);
        const rects = ui.coverageMaskShapes.map(s => s.points);

        // Clear all — soft-delete so inventory logic accounts correctly
        if (existing && rects.length === 0) {
          _clearedAnnId = existing.id;
          await data.annotations!.delete(existing.id);
          return;
        }

        if (existing) {
          // Collect existing tile keys from the annotation's shape_args
          const existingTileKeys = new Set<string>();
          if (existing.shape_args) {
            for (const key of Object.keys(existing.shape_args as Record<string, unknown>)) {
              if (isTileKey(key)) existingTileKeys.add(key.replace(/^tile-/, "").replace("x", ":"));
            }
          }
          // Build entries: upsert current tiles + delete stale ones
          const entries = buildTileEntries(rects, existingTileKeys);
          await writeTileEntries(
            { setShape: data.annotations!.setShape.bind(data.annotations), setShapes: data.annotations!.setShapes.bind(data.annotations) },
            existing.id,
            entries,
          );
        } else if (rects.length > 0) {
          // First save: create fresh or restore soft-deleted
          let ann: { id: string };
          if (_clearedAnnId) {
            ann = await data.annotations!.restore({
              id: _clearedAnnId,
              shape_type: COVERAGE_DONE_AREA,
              category: "done_area",
              shape_args: {},
              properties: {},
            } as any);
            _clearedAnnId = null;
          } else {
            ann = await data.annotations!.create({
              shape_type: COVERAGE_DONE_AREA,
              category: "done_area",
              shape_args: {},
              resource: driver.media.resource,
            });
          }

          const entries = buildTileEntries(rects);
          if (entries.length > 0) {
            await writeTileEntries(
              { setShape: data.annotations!.setShape.bind(data.annotations), setShapes: data.annotations!.setShapes.bind(data.annotations) },
              ann.id,
              entries,
            );
          }
        }
      },
      isCombinable() { return false; },
      combine(p: any) { return p; },
    }),
    group: command.group,
  });
}

/**
 * Load persisted coverage masks into ui state. Call after initDataStores().
 *
 * Reads tile-{col}x{row} entries from shape_args (merged from annotation_shape
 * table by the backend). Decodes RLE → pixel buffer → per-row rects for display.
 * Falls back to legacy shape_args.rects format.
 */
export function loadCoverageMasks(): void {
  const ann = data.annotations?.items.find(a => a.shape_type === COVERAGE_DONE_AREA);
  if (!ann?.shape_args) return;

  const args = ann.shape_args as Record<string, unknown>;

  // Extract tile entries from shape_args (merged from annotation_shape table)
  const tileEntries: Array<{ col: number; row: number; rle: string }> = [];
  for (const [key, value] of Object.entries(args)) {
    if (isTileKey(key) && value && typeof value === "object" && (value as Record<string, unknown>).rle) {
      const match = key.match(/^tile-(\d+)x(\d+)$/);
      if (match) {
        tileEntries.push({
          col: parseInt(match[1], 10),
          row: parseInt(match[2], 10),
          rle: (value as { rle: string }).rle,
        });
      }
    }
  }

  if (tileEntries.length > 0) {
    // Convert tile pixel data to per-row rects for SVG display
    const shapes: Array<{ type: "bbox"; points: number[] }> = [];

    for (const { col, row, rle } of tileEntries) {
      const buffer = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
      const originX = col * MASK_TILE_SIZE;
      const originY = row * MASK_TILE_SIZE;

      for (let py = 0; py < MASK_TILE_SIZE; py++) {
        let px = 0;
        while (px < MASK_TILE_SIZE) {
          if (buffer[py * MASK_TILE_SIZE + px] === 1) {
            const startX = px;
            while (px < MASK_TILE_SIZE && buffer[py * MASK_TILE_SIZE + px] === 1) {
              px++;
            }
            shapes.push({
              type: "bbox" as const,
              points: [originX + startX, originY + py, px - startX, 1],
            });
          } else {
            px++;
          }
        }
      }
    }

    ui.coverageMaskShapes = shapes;
  } else {
    // Fallback: legacy format — direct rects array in shape_args
    const legacyRects = args["rects"];
    if (Array.isArray(legacyRects) && legacyRects.length > 0) {
      ui.coverageMaskShapes = (legacyRects as number[][]).map((r) => ({
        type: "bbox" as const,
        points: r,
      }));
    }
  }
}
