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
//   Circle        → radius, area
//   Ellipse       → hRadius, vRadius, area
//   Line          → length
// ---------------------------------------------------------------------------

import type { Point } from "$lib/utils/math/point";
import {
  IMAGE_BOUNDING_BOX,
  IMAGE_POLYGON,
  IMAGE_LINE,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
} from "$lib/types";

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
 * Return dimension entries for a shape.
 * If the shape carries a pre-stored `dimensions` key, uses that directly.
 * Returns null when no dimensions can be computed.
 */
export function getShapeDimensions(
  shape: Record<string, unknown> | undefined | null,
  mediaWidth: number,
  mediaHeight: number,
): { label: string; value: string }[] | null {
  if (!shape) return null;

  // Use pre-stored dimensions when available (set by creation / edit flow).
  if (shape.dimensions) {
    const d = shape.dimensions as Record<string, number | undefined>;
    const out: { label: string; value: string }[] = [];
    if (d.width !== undefined && d.height !== undefined) {
      out.push({ label: "Width", value: `${d.width} px` });
      out.push({ label: "Height", value: `${d.height} px` });
    }
    if (d.radius !== undefined) out.push({ label: "Radius", value: `${d.radius} px` });
    if (d.hRadius !== undefined && d.vRadius !== undefined) {
      out.push({ label: "H. Radius", value: `${d.hRadius} px` });
      out.push({ label: "V. Radius", value: `${d.vRadius} px` });
    }
    if (d.length !== undefined) out.push({ label: "Length", value: `${d.length} px` });
    if (d.numPoints !== undefined) out.push({ label: "Points", value: `${d.numPoints}` });
    if (d.area !== undefined) out.push({ label: "Area", value: `${d.area.toLocaleString()} px²` });
    return out.length > 0 ? out : null;
  }

  const type = shape.type as string;

  // ── Circle ──────────────────────────────────────────────────────
  if (type === IMAGE_CIRCLE) {
    const rNorm = (shape.radius as number) ?? 0;
    const radiusPx = Math.round(rNorm * Math.min(mediaWidth, mediaHeight));
    const area = Math.round(Math.PI * radiusPx * radiusPx);
    return [
      { label: "Radius", value: `${radiusPx} px` },
      { label: "Area", value: `${area.toLocaleString()} px²` },
    ];
  }

  // ── Ellipse ─────────────────────────────────────────────────────
  if (type === IMAGE_ELLIPSE) {
    const pts = shape.points as Point[] | undefined;
    const rxNorm = pts && pts.length >= 2 ? pts[1][0] : 0;
    const ryNorm = pts && pts.length >= 2 ? pts[1][1] : 0;
    const hR = Math.round(Math.abs(rxNorm) * mediaWidth);
    const vR = Math.round(Math.abs(ryNorm) * mediaHeight);
    const area = Math.round(Math.PI * hR * vR);
    return [
      { label: "H. Radius", value: `${hR} px` },
      { label: "V. Radius", value: `${vR} px` },
      { label: "Area", value: `${area.toLocaleString()} px²` },
    ];
  }

  const points = shape.points as Point[] | undefined;
  if (!points || points.length < 2) return null;

  // ── Bounding box ────────────────────────────────────────────────
  if (type === IMAGE_BOUNDING_BOX) {
    if (points.length < 4) return null;
    const { w, h } = aabbWH(points, mediaWidth, mediaHeight);
    return [
      { label: "Width", value: `${w} px` },
      { label: "Height", value: `${h} px` },
      { label: "Area", value: `${(w * h).toLocaleString()} px²` },
    ];
  }

  // ── Polygon ─────────────────────────────────────────────────────
  if (type === IMAGE_POLYGON) {
    const { w, h } = aabbWH(points, mediaWidth, mediaHeight);
    return [
      { label: "Width", value: `${w} px` },
      { label: "Height", value: `${h} px` },
      { label: "Points", value: `${points.length}` },
    ];
  }

  // ── Line ────────────────────────────────────────────────────────
  if (type === IMAGE_LINE) {
    const dx = (points[1][0] - points[0][0]) * mediaWidth;
    const dy = (points[1][1] - points[0][1]) * mediaHeight;
    return [{ label: "Length", value: `${Math.round(Math.sqrt(dx * dx + dy * dy))} px` }];
  }

  return null;
}
