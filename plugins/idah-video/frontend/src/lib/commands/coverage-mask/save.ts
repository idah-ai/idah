// ---------------------------------------------------------------------------
// coverage-mask/save — Persist coverage mask rectangles to backend as tiles
//
// Coverage masks are stored as pixel mask tiles (tile-{col}x{row}) using
// the same setShape/annotation_shape mechanism as the IMAGE_MASK tile system.
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { data } from "$lib/state/data.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { COVERAGE_DONE_AREA } from "$lib/types";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { decode } from "$lib/mask/rle";
import { isTileKey } from "$lib/mask/strip-tile-keys";
import { buildTileEntries } from "$lib/mask/coverage-mask";

/** Write tile entries via the shared driver's setShape/setShapes. */
async function writeTiles(
  annotationId: string,
  entries: Array<{ key: string; value: object | null }>,
): Promise<void> {
  const driver = getDriver();
  if (!driver?.annotations) return;
  if (entries.length === 1) {
    await driver.annotations.setShape(annotationId, entries[0].key, entries[0].value);
  } else if (entries.length > 1) {
    await driver.annotations.setShapes(annotationId, entries);
  }
}

export const command = {
  name: "coverage-mask-save",
  group: "Coverage Mask",
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null as string | null,
  longDescription: null as string | null,
};

export function register(driver: IIdahDriverV2): void {
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
          await writeTiles(existing.id, entries);
        } else if (rects.length > 0) {
          // First save: create annotation + store tiles
          const meta = driver.media.meta as Record<string, unknown>;
          const totalFrames = Math.floor((meta.duration as number) * (meta.fps as number)) - 1;
          const ann = await data.annotations!.create({
            shape_type: COVERAGE_DONE_AREA,
            category: "done_area",
            shape_args: { start: 0, end: Math.max(0, totalFrames) },
            resource: driver.media.resource,
          });

          const entries = buildTileEntries(rects);
          if (entries.length > 0) {
            await writeTiles(ann.id, entries);
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
  if (!data.annotations) return;
  const items = data.annotations.items;
  const ann = items.find(a => a.shape_type === COVERAGE_DONE_AREA);

  if (!ann) return
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
