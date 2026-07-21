// ---------------------------------------------------------------------------
// mode.mask_brush — Brush mask paint tool
//
// Pointer interaction:
//   - Pointer down: begin painting at current position
//   - Pointer move: paint/erase along the stroke (local only, no backend calls)
//   - Pointer up: flush the session to the backend
//   - Escape: cancel gesture, discard session buffer
//
// Brush radius is adjustable, in image-pixel units.
// Add/remove mode follows the mask session's current mode.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_MASK, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON } from "$lib/types";
import { hasConfig } from "$idah/v2/utils";
import { maskSession } from "$lib/state/mask-session.svelte";
import { tilesTouchedByCircle } from "$lib/mask/grid";
import { paintCircle } from "$lib/mask/raster";
import { isEditable } from "$lib/state/editor.svelte";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { media } from "$lib/state/media.svelte";
import { maskTool } from "$lib/state/mask-tool.svelte";
import { data } from "$lib/state/data.svelte";
import { rebuildOccupancy, isOccupied } from "$lib/mask/occupancy";

export const command = {
  name: "mode.mask_brush",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK],
  shortcut: "Q",
  shortDescription: "Mask Brush",
  longDescription: "Paint or erase mask annotations with a brush.",
};

// ─── Brush state (per-gesture, managed by the tool) ──────────────────────

let _isPainting = false;

export function setBrushRadius(radius: number): void {
  maskTool.brushRadius = radius;
}

export function getBrushRadius(): number {
  return maskTool.brushRadius;
}

export function register(driver: IIdahDriverV2): void {
  if (!hasConfig(driver, IMAGE_MASK)) return;

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

      return {
        command: { ...command },
        do() {
          maskTool.active = "brush";
          driver.toolbar.invalidate();
          if (driver.mode !== IMAGE_MASK) {
            driver.setMode(IMAGE_MASK);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}

// ─── Pointer event handlers (called from the canvas component) ───────────

/**
 * Called when the user presses down on the canvas.
 * Resolves or creates the mask session, then paints the first dab.
 */
export function onPointerDown(
  imgX: number,
  imgY: number,
  annotationId: string | undefined,
): void {
  if (!isEditable()) return;

  _isPainting = true;
  maskSession.beginSession(annotationId);

  // Rebuild occupancy grid if overlap prevention is enabled
  if (maskTool.preventOverlap && data.annotations) {
    rebuildOccupancy(data.annotations.items);
  }

  // If editing an existing annotation, load all its tiles into the session
  if (annotationId && data.annotations) {
    const record = data.annotations.items.find((a) => a.id === annotationId);
    if (record) {
      const shape = record.shape as Record<string, unknown>;
      for (const [key, val] of Object.entries(shape)) {
        if (!key.startsWith("tile-")) continue;
        const match = key.match(/^tile-(\d+)x(\d+)$/);
        if (!match) continue;
        const col = parseInt(match[1], 10);
        const row = parseInt(match[2], 10);
        const tileData = val as { rle?: string } | undefined;
        if (!tileData?.rle) continue;
        maskSession.ensureTileBuffer(col, row, tileData.rle);
      }
    }
  }

  paintDab(imgX, imgY);
}

/**
 * Called on pointer move while painting.
 */
export function onPointerMove(imgX: number, imgY: number): void {
  if (!_isPainting) return;
  paintDab(imgX, imgY);
}

/**
 * Called on pointer up — flushes the session to the backend.
 */
export function onPointerUp(driver: IIdahDriverV2): void {
  if (!_isPainting) return;
  _isPainting = false;

  driver.command.call("annotation.mask_shapes.flush");
}

/**
 * Called on gesture cancellation (Escape key, tool switch mid-drag).
 */
export function onCancel(): void {
  _isPainting = false;
  maskSession.reset();
}

// ─── Internal ────────────────────────────────────────────────────────────

function paintDab(imgX: number, imgY: number): void {
  // Snap to pixel center, matching the cursor display calculation
  const cx = Math.floor(imgX) + 0.5;
  const cy = Math.floor(imgY) + 0.5;
  const tiles = tilesTouchedByCircle(cx, cy, maskTool.brushRadius);

  for (const { col, row } of tiles) {
    const tileOriginX = col * MASK_TILE_SIZE;
    const tileOriginY = row * MASK_TILE_SIZE;
    if (tileOriginX >= media.width || tileOriginY >= media.height) continue;

    const buf = maskSession.ensureTileBuffer(col, row);
    const checkOccupied = maskTool.preventOverlap
      ? (localPx: number, localPy: number) => isOccupied(col, row, localPx, localPy)
      : undefined;
    paintCircle(buf, tileOriginX, tileOriginY, cx, cy, maskTool.brushRadius, maskSession.mode, media.width, media.height, checkOccupied);
    maskSession.markDirty(col, row);
  }
}
