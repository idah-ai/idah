// ---------------------------------------------------------------------------
// Polygon utils — handle positions, edge midpoints, hit testing, scaling
// ---------------------------------------------------------------------------
import type { Point } from "$lib/utils/math/point";
import { distance } from "$lib/utils/math/point";

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
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > point[1]) !== (yj > point[1]) &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find the closest vertex handle index, or -1 if none within hitRadius. */
export function hitTestVertex(point: Point, vertices: Point[], w: number, h: number, hitRadiusPx: number): number {
  const rSq = hitRadiusPx * hitRadiusPx;
  for (let i = 0; i < vertices.length; i++) {
    const dx = Math.abs(point[0] - vertices[i][0]) * w;
    const dy = Math.abs(point[1] - vertices[i][1]) * h;
    if (dx * dx + dy * dy < rSq) return i;
  }
  return -1;
}

/** Find the closest edge midpoint index, or -1 if none within hitRadius. */
export function hitTestEdgeMidpoint(point: Point, vertices: Point[], w: number, h: number, hitRadiusPx: number): number {
  const midpoints = polygonEdgeMidpoints(vertices);
  const rSq = hitRadiusPx * hitRadiusPx;
  for (let i = 0; i < midpoints.length; i++) {
    const dx = Math.abs(point[0] - midpoints[i][0]) * w;
    const dy = Math.abs(point[1] - midpoints[i][1]) * h;
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
  return vertices.map((p) => [
    c[0] + (p[0] - c[0]) * factor,
    c[1] + (p[1] - c[1]) * factor,
  ]) as Point[];
}

/**
 * Compute the scale factor from a drag interaction.
 * The factor is based on the ratio of the current distance from centroid to cursor
 * over the initial distance from centroid to cursor.
 */
export function computeScaleFactor(
  centroid: Point,
  dragStart: Point,
  currentCursor: Point,
): number {
  const initialDist = distance(centroid, dragStart);
  if (initialDist < 0.001) return 1; // Avoid division by zero / extreme scaling
  const currentDist = distance(centroid, currentCursor);
  return currentDist / initialDist;
}

/** SVG data URL for a dot sight crosshair cursor (crosshair with a central dot). */
export function scaleCursorSVG(color: string): string {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2" fill="${color}"/>
      <line x1="12" y1="3" x2="12" y2="9" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="12" y1="15" x2="12" y2="21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="3" y1="12" x2="9" y2="12" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="15" y1="12" x2="21" y2="12" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`)}`;
}

/** SVG data URL for a close-target cursor (crosshair + corner brackets + central dot). */
export function targetCursorSVG(color: string): string {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="${color}" stroke-width="1.5" fill="none"/>
      <circle cx="12" cy="12" r="2" fill="${color}"/>
      <path d="M12 4 L12 8 M12 16 L12 20 M4 12 L8 12 M16 12 L20 12" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 8 L4 4 M16 8 L20 4 M8 16 L4 20 M16 16 L20 20" stroke="${color}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
    </svg>`)}`;
}
