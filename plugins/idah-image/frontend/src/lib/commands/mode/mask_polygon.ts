// ---------------------------------------------------------------------------
// mode.mask_polygon — Polygon mask fill tool
//
// Click to add polygon vertices. Double-click or click near the first
// vertex to close the polygon and flush the fill to the backend.
//
// Add/remove mode follows the mask session's current mode.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_MASK, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON } from "$lib/types";
import { hasConfig } from "$idah/v2/utils";
import { maskSession } from "$lib/state/mask-session.svelte";
import { tilesTouchedByPolygon } from "$lib/mask/grid";
import { fillPolygon } from "$lib/mask/raster";
import { isEditable } from "$lib/state/editor.svelte";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { noopAction } from "..";
import { maskTool } from "$lib/state/mask-tool.svelte";
import { media } from "$lib/state/media.svelte";
import { rebuildOccupancy, isOccupied } from "$lib/mask/occupancy";
import { data } from "$lib/state/data.svelte";

export const command = {
  name: "mode.mask_polygon",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK],
  shortcut: "W",
  shortDescription: "Mask Polygon",
  longDescription: "Fill a polygon region as a mask annotation.",
};

// ─── Draft state (accumulated during gesture) ────────────────────────────

// NOTE: This variable is NOT reactive ($state runes only work in .svelte.ts files).
// The MaskPolygonCreateShape component forces reactivity by re-reading
// maskPolygonDraft.points inside its own internal reactive state.
// We use a callback-based approach: the component re-renders by cloning
// the points array on each mutation.

export let _draftPoints: [number, number][] = [];
export let _annotationId: string | undefined;

// Notification callback — set by MaskPolygonCreateShape on mount so the
// module-level code can trigger a component re-render when points change.
let _onPointsChanged: (() => void) | null = null;

export function setOnPointsChanged(fn: () => void): void {
  _onPointsChanged = fn;
}

function notifyPointsChanged(): void {
  _onPointsChanged?.();
}

export const maskPolygonDraft = {
  get points(): [number, number][] {
    return _draftPoints;
  },
  set points(p: [number, number][]) {
    _draftPoints = p;
    notifyPointsChanged();
  },

  get annotationId(): string | undefined {
    return _annotationId;
  },
  set annotationId(id: string | undefined) {
    _annotationId = id;
  },

  /**
   * Push a point and notify listeners.
   */
  pushPoint(p: [number, number]): void {
    _draftPoints = [..._draftPoints, p];
    notifyPointsChanged();
  },

  /**
   * Clear all points and notify listeners.
   */
  clearPoints(): void {
    _draftPoints = [];
    _annotationId = undefined;
    notifyPointsChanged();
  },
};

export function register(driver: IIdahDriverV2): void {
  if (!hasConfig(driver, IMAGE_MASK)) return;

  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);

      return {
        command: { ...command },
        do() {
          maskTool.active = "polygon";
          driver.toolbar.invalidate();
          if (driver.mode !== IMAGE_MASK) {
            // Reset draft when entering the mode
            _draftPoints = [];
            _annotationId = undefined;
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
 * Add a point to the polygon draft.
 * Returns true if the polygon was closed (double-click / near-first-vertex).
 */
export function addPoint(
  imgX: number,
  imgY: number,
  annotationId: string | undefined,
  closeThreshold: number = 10,
): boolean {
  // Check if the user clicked near the first point to close the polygon
  if (_draftPoints.length >= 3) {
    const first = _draftPoints[0];
    const dx = imgX - first[0];
    const dy = imgY - first[1];
    if (dx * dx + dy * dy <= closeThreshold * closeThreshold) {
      return closePolygon(annotationId);
    }
  }

  maskPolygonDraft.pushPoint([imgX, imgY]);
  maskPolygonDraft.annotationId = annotationId;
  return false;
}

/**
 * Close the polygon and flush the fill.
 */
export function closePolygon(annotationId: string | undefined): boolean {
  if (_draftPoints.length < 3) return false;

  // Paint the polygon fill into the session buffers
  maskSession.beginSession(annotationId);

  // Rebuild occupancy grid if overlap prevention is enabled
  if (maskTool.preventOverlap && data.annotations) {
    rebuildOccupancy(data.annotations.items);
  }

  const touchedTiles = tilesTouchedByPolygon(_draftPoints);

  for (const { col, row } of touchedTiles) {
    const buf = maskSession.ensureTileBuffer(col, row);
    const tileOriginX = col * MASK_TILE_SIZE;
    const tileOriginY = row * MASK_TILE_SIZE;

    const checkOccupied = maskTool.preventOverlap
      ? (localPx: number, localPy: number) => isOccupied(col, row, localPx, localPy)
      : undefined;
    const painted = fillPolygon(buf, tileOriginX, tileOriginY, _draftPoints, maskSession.mode, media.width, media.height, checkOccupied);
    if (painted) {
      maskSession.markDirty(col, row);
    }
  }

  // Reset draft state
  maskPolygonDraft.clearPoints();

  return true;
}

/**
 * Cancel the current polygon draft.
 */
export function cancelDraft(): void {
  maskPolygonDraft.clearPoints();
  maskSession.reset();
}
