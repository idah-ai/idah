// ---------------------------------------------------------------------------
// Polygon utils — handle positions, edge midpoints, hit testing, scaling
// ---------------------------------------------------------------------------
import { distance, type Point } from "$lib/utils/math/point";

/** Generate handle positions for each vertex. */
export function polygonVertexHandles(pts: Point[]): Point[] {
  return pts;
}

/** Generate edge midpoint handles (for adding vertices). */
export function polygonEdgeMidpoints(pts: Point[]): Point[] {
  if (pts.length < 2) return [];
  const midpoints: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const next = (i + 1) % pts.length;
    midpoints.push([(pts[i][0] + pts[next][0]) / 2, (pts[i][1] + pts[next][1]) / 2]);
  }
  return midpoints;
}

/** Compute the centroid of a polygon. */
export function polygonCentroid(pts: Point[]): Point {
  if (pts.length === 0) return [0, 0];
  const sum = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

/**
 * Check if a point is inside a polygon (ray casting algorithm).
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Find the closest vertex handle index, or -1 if none within hitRadius.
 * @param point - normalized cursor position [0-1]
 * @param vertices - polygon vertices as normalized points [0-1]
 * @param w - media width in pixels (for converting to screen space)
 * @param h - media height in pixels (for converting to screen space)
 * @param hitRadiusPx - radius in pixels for hit testing
 * @param viewportScale - the current viewport zoom scale to convert media pixels to screen pixels
 */
export function hitTestVertex(
  point: Point,
  vertices: Point[],
  w: number,
  h: number,
  hitRadiusPx: number,
  viewportScale: number = 1,
): number {
  const rSq = hitRadiusPx * hitRadiusPx;
  for (let i = 0; i < vertices.length; i++) {
    const dx = Math.abs(point[0] - vertices[i][0]) * w * viewportScale;
    const dy = Math.abs(point[1] - vertices[i][1]) * h * viewportScale;

    if (dx * dx + dy * dy < rSq) return i;
  }
  return -1;
}

/**
 * Find the closest edge midpoint index, or -1 if none within hitRadius.
 * @param point - normalized cursor position [0-1]
 * @param vertices - polygon vertices as normalized points [0-1]
 * @param w - media width in pixels (for converting to screen space)
 * @param h - media height in pixels (for converting to screen space)
 * @param hitRadiusPx - radius in pixels for hit testing
 * @param viewportScale - the current viewport zoom scale to convert media pixels to screen pixels
 */
export function hitTestEdgeMidpoint(
  point: Point,
  vertices: Point[],
  w: number,
  h: number,
  hitRadiusPx: number,
  viewportScale: number = 1,
): number {
  const midpoints = polygonEdgeMidpoints(vertices);
  const rSq = hitRadiusPx * hitRadiusPx;
  for (let i = 0; i < midpoints.length; i++) {
    const dx = Math.abs(point[0] - midpoints[i][0]) * w * viewportScale;
    const dy = Math.abs(point[1] - midpoints[i][1]) * h * viewportScale;
    if (dx * dx + dy * dy < rSq) return i;
  }
  return -1;
}

/** Dragging a vertex: return new points with that vertex moved to cursor. */
export function moveVertex(vertices: Point[], index: number, target: Point): Point[] {
  const result = [...vertices];
  result[index] = target;
  return result;
}

/**
 * Insert a new vertex at edge `edgeIndex` (between vertices[edgeIndex] and vertices[(edgeIndex+1)%n]).
 * The new vertex is placed at the midpoint of that edge.
 */
export function addVertexOnEdge(vertices: Point[], edgeIndex: number): { vertices: Point[]; insertedIndex: number } {
  if (vertices.length < 2) return { vertices, insertedIndex: -1 };
  const next = (edgeIndex + 1) % vertices.length;
  const mid: Point = [
    (vertices[edgeIndex][0] + vertices[next][0]) / 2,
    (vertices[edgeIndex][1] + vertices[next][1]) / 2,
  ];
  const result = [...vertices];
  const insertedIndex = edgeIndex + 1;
  result.splice(insertedIndex, 0, mid);
  return { vertices: result, insertedIndex };
}

/**
 * Scale a polygon's vertices by a factor relative to its centroid.
 */
export function scalePolygon(vertices: Point[], factor: number): Point[] {
  if (vertices.length < 3 || factor <= 0) return [...vertices];
  const c = polygonCentroid(vertices);
  return vertices.map((p) => [c[0] + (p[0] - c[0]) * factor, c[1] + (p[1] - c[1]) * factor]) as Point[];
}

/**
 * Compute the scale factor from a drag interaction.
 * The factor is based on the ratio of the current distance from centroid to cursor
 * over the initial distance from centroid to cursor.
 */
export function computeScaleFactor(centroid: Point, dragStart: Point, currentCursor: Point): number {
  const initialDist = distance(centroid, dragStart);
  if (initialDist < 0.001) return 1; // Avoid division by zero / extreme scaling
  const currentDist = distance(centroid, currentCursor);
  return currentDist / initialDist;
}

/**
 * Check if a normalized cursor is within `hitRadiusPx` pixels of the first polygon draft point.
 * Used to determine when to close a polygon during creation.
 *
 * @param cursor - normalized cursor position [0-1]
 * @param mediaWidth - media width in pixels
 * @param mediaHeight - media height in pixels
 * @param points - polygon draft points as normalized coordinates [0-1]
 * @param viewportScale - current viewport zoom scale (media pixels → screen pixels)
 */
export function nearFirstPolygonPoint(
  cursor: Point,
  mediaWidth: number,
  mediaHeight: number,
  points: Point[],
  viewportScale: number = 1,
): boolean {
  if (points.length < 3) return false;
  const screenToMediaScale = 1 / viewportScale;
  const closeRadiusMediaPx = 7 * screenToMediaScale;
  const closeRadiusMediaPxSq = closeRadiusMediaPx * closeRadiusMediaPx;
  const first = points[0];
  const dx = Math.abs(cursor[0] - first[0]) * mediaWidth;
  const dy = Math.abs(cursor[1] - first[1]) * mediaHeight;
  return dx * dx + dy * dy < closeRadiusMediaPxSq;
}

/** SVG data URL for a dot sight crosshair cursor (crosshair with a central dot). */
export function scaleCursorSVG(color: string): string {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="white"/>
      <circle cx="12" cy="12" r="2" fill="${color}"/>
      <line x1="12" y1="2" x2="12" y2="8" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <line x1="12" y1="2" x2="12" y2="8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="16" x2="12" y2="22" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <line x1="12" y1="16" x2="12" y2="22" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="8" y2="12" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="8" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="16" y1="12" x2="22" y2="12" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <line x1="16" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`)}`;
}
