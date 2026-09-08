// ---------------------------------------------------------------------------
// utils/dimensions.ts — Shape dimension computation
//
// Computes pixel dimensions from shape geometry for display on canvas and in
// the sidebar.  If the shape already carries a `dimensions` key (stored by the
// creation/edit flow), those values are returned directly — this avoids
// recomputation and allows the backend to supply dimensions.
//
// Per-type dimensions:
//   Bounding Box  → width, height, area
//   Polygon       → width, height, numPoints
// ---------------------------------------------------------------------------

import type { Point } from "$lib/utils/math/point";
import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";

export interface IShapeDimensions {
  width?: number;
  height?: number;
  area?: number;
  numPoints?: number;
  radius?: number;
  hRadius?: number;
  vRadius?: number;
  length?: number;
}

/** AABB width/height from normalized points (in pixels). */
function aabbWH(points: Point[], mw: number, mh: number): { w: number; h: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    w: Math.round((Math.max(...xs) - Math.min(...xs)) * mw),
    h: Math.round((Math.max(...ys) - Math.min(...ys)) * mh),
  };
}

/**
 * Return pixel dimensions for a shape, falling back to pre-stored
 * `shape.dimensions` when available.
 */
export function getShapeDimensions(
  shape: Record<string, unknown> | undefined | null,
  mediaWidth: number,
  mediaHeight: number,
): IShapeDimensions | null {
  if (!shape) return null;

  // Use pre-stored dimensions when available (set by creation / edit flow).
  if (shape.dimensions) return shape.dimensions as IShapeDimensions;

  const points = shape.points as Point[] | undefined;
  if (!points || points.length < 2) return null;

  const type = shape.type as string;

  // ── Bounding box ────────────────────────────────────────────────
  if (type === VIDEO_BOUNDING_BOX) {
    if (points.length < 4) return null;
    const { w, h } = aabbWH(points, mediaWidth, mediaHeight);
    return { width: w, height: h, area: w * h };
  }

  // ── Polygon ─────────────────────────────────────────────────────
  if (type === VIDEO_POLYGON) {
    const { w, h } = aabbWH(points, mediaWidth, mediaHeight);
    return { width: w, height: h, numPoints: points.length };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable dimension entries for a shape.
 * Returns an array of { label, value } pairs suitable for rendering.
 */
export function getDimensionEntries(dims: IShapeDimensions): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];

  if (dims.width !== undefined && dims.height !== undefined) {
    out.push({ label: "Width", value: `${dims.width} px` });
    out.push({ label: "Height", value: `${dims.height} px` });
  }
  if (dims.radius !== undefined) {
    out.push({ label: "Radius", value: `${dims.radius} px` });
  }
  if (dims.hRadius !== undefined && dims.vRadius !== undefined) {
    out.push({ label: "H. Radius", value: `${dims.hRadius} px` });
    out.push({ label: "V. Radius", value: `${dims.vRadius} px` });
  }
  if (dims.length !== undefined) {
    out.push({ label: "Length", value: `${dims.length} px` });
  }
  if (dims.numPoints !== undefined) {
    out.push({ label: "Points", value: `${dims.numPoints}` });
  }
  if (dims.area !== undefined) {
    out.push({ label: "Area", value: `${dims.area.toLocaleString()} px²` });
  }

  return out;
}