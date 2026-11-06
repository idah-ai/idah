// ---------------------------------------------------------------------------
// utils/shape-bounds.ts — the points that frame a shape for viewport centering.
//
// Pure and testable: given a shape, its type and the media dimensions, returns
// the normalized points whose AABB frames the shape, or null when there is
// nothing to frame (e.g. a mask with no points). The caller keeps the zoom and
// padding behaviour.
// ---------------------------------------------------------------------------
import {
  IMAGE_BOUNDING_BOX,
  IMAGE_POLYGON,
  IMAGE_LINE,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  type IImageAnnotationShape,
} from "$lib/types";

export type Point = [number, number];

/**
 * The normalized points whose AABB frames the shape, chosen by `shapeType`:
 * - bounding box / polygon: the bounds of their points;
 * - line: the bounds of its 2 points;
 * - ellipse: `points[0]` ± `points[1]`;
 * - circle: `points[0]` ± `radius × min(width, height)`, converted per axis;
 * - a rotated shape: as today (AABB corners rotated around their centroid);
 * - a mask with no points: null (no viewport change).
 */
export function shapeBoundsPoints(
  shape: IImageAnnotationShape | undefined,
  shapeType: string | undefined,
  mediaWidth: number,
  mediaHeight: number,
): Point[] | null {
  if (!shape) return null;
  let points = shape.points;
  if (!points || points.length === 0) return null;

  const angle = (shape.angle as number | undefined) ?? 0;
  const radius = shape.radius as number | undefined;

  if (shapeType === IMAGE_CIRCLE && radius && points.length === 1) {
    const [cx, cy] = points[0];
    // The radius is normalized against min(width, height); convert it to
    // per-axis normalized offsets so a non-square image frames correctly.
    const pixelRadius = radius * Math.min(mediaWidth, mediaHeight);
    const rx = mediaWidth > 0 ? pixelRadius / mediaWidth : 0;
    const ry = mediaHeight > 0 ? pixelRadius / mediaHeight : 0;
    points = [
      [cx - rx, cy - ry],
      [cx + rx, cy - ry],
      [cx + rx, cy + ry],
      [cx - rx, cy + ry],
    ];
  } else if (shapeType === IMAGE_ELLIPSE && points.length === 2) {
    // Ellipse: points = [[cx, cy], [rx, ry]].
    const [cx, cy] = points[0];
    const [rx, ry] = points[1];
    points = [
      [cx - rx, cy - ry],
      [cx + rx, cy - ry],
      [cx + rx, cy + ry],
      [cx - rx, cy + ry],
    ];
  }
  // Bounding box, polygon and line use their points as-is (a line's 2 points
  // give its bounds).

  // For rotated shapes, rotate the AABB corners around their centroid.
  if (angle !== 0 && points.length >= 3) {
    let cx = 0,
      cy = 0;
    for (const [px, py] of points) {
      cx += px;
      cy += py;
    }
    cx /= points.length;
    cy /= points.length;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    points = points.map(
      ([px, py]) => [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos] as Point,
    );
  }

  return points;
}

/** The AABB of the framing points, in normalized units. */
export function shapeBounds(
  shape: IImageAnnotationShape | undefined,
  shapeType: string | undefined,
  mediaWidth: number,
  mediaHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const points = shapeBoundsPoints(shape, shapeType, mediaWidth, mediaHeight);
  if (!points) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { minX, minY, maxX, maxY };
}
