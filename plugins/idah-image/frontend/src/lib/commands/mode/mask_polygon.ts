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
import { isEditable } from "$lib/state/editor.svelte";
import { noopAction } from "..";
import { maskTool } from "$lib/state/mask-tool.svelte";

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

/**
 * Snapshot of draft points saved just before clearing on polygon close.
 * Used by undo handlers (add.ts, mask_shapes.flush.ts) to restore the
 * polygon preview so the user can continue editing or undo individual
 * add_point commands.
 */
export let _closedPoints: [number, number][] | null = null;

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

  get closedPoints(): [number, number][] | null {
    return _closedPoints;
  },
  set closedPoints(p: [number, number][] | null) {
    _closedPoints = p;
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
            _closedPoints = null;
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


