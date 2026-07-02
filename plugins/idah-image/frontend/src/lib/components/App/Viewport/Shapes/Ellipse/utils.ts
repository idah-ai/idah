// ---------------------------------------------------------------------------
// Ellipse utils — handle positions, hit testing, AABB helpers
// ---------------------------------------------------------------------------
import { rotatePoint, type Point } from "$lib/utils/math/point";

/**
 * Compute the 4 corners of the AABB that encloses the unrotated ellipse.
 * Returns in [tl, tr, br, bl] order (normalized coordinates).
 */
export function ellipseAABB(
  centroid: Point,
  radiusX: number,
  radiusY: number,
): Point[] {
  const [cx, cy] = centroid;
  return [
    [cx - radiusX, cy - radiusY],
    [cx + radiusX, cy - radiusY],
    [cx + radiusX, cy + radiusY],
    [cx - radiusX, cy + radiusY],
  ];
}

/** Generate 8 handle positions from the ellipse's AABB: 4 corners + 4 edge midpoints */
export function ellipseHandles(
  centroid: Point,
  radiusX: number,
  radiusY: number,
  angle: number,
  w: number,
  h: number,
): Point[] {
  const aabb = ellipseAABB(centroid, radiusX, radiusY);
  const handles: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    const corner = rotatePointN(aabb[i], centroid, angle, w, h);
    const mid = rotatePointN(
      [(aabb[i][0] + aabb[next][0]) / 2, (aabb[i][1] + aabb[next][1]) / 2],
      centroid,
      angle,
      w,
      h,
    );
    handles.push(corner);
    handles.push(mid);
  }
  return handles;
}

/** Rotate a normalized point around a normalized center, doing math in pixel space */
export function rotatePointN(point: Point, center: Point, angleRad: number, w: number, h: number): Point {
  const pPx: Point = [point[0] * w, point[1] * h];
  const cPx: Point = [center[0] * w, center[1] * h];
  const rotated = rotatePoint(pPx, cPx, angleRad);
  return [rotated[0] / w, rotated[1] / h];
}

/** Inverse rotation */
export function inverseRotatePointN(point: Point, center: Point, angleRad: number, w: number, h: number): Point {
  return rotatePointN(point, center, -angleRad, w, h);
}

/** CSS cursor name for each handle index (0-7) */
export function handleCursor(handleIndex: number): string {
  return (
    ["nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][
      handleIndex
    ] ?? "grab"
  );
}

/** SVG data URL for a rotated resize cursor */
export function rotatedCursorSVG(handleIndex: number, angleRad: number, color: string): string {
  const deg = (angleRad * 180) / Math.PI;
  const type = handleCursor(handleIndex);

  const arrow =
    type === "nwse-resize"
      ? `<path d="M8 8L4 4M4 4H8M4 4V8" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8L4 4M4 4H8M4 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16L20 20M20 20H16M20 20V16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16L20 20M20 20H16M20 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : type === "nesw-resize"
        ? `<path d="M16 8L20 4M20 4H16M20 4V8" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8L20 4M20 4H16M20 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16L4 20M4 20H8M4 20V16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16L4 20M4 20H8M4 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        : type === "ns-resize"
          ? `<path d="M12 4V20M12 4L9 7M12 4L15 7M12 20L9 17M12 20L15 17" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4V20M12 4L9 7M12 4L15 7M12 20L9 17M12 20L15 17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<path d="M4 12H20M4 12L7 9M4 12L7 15M20 12L17 9M20 12L17 15" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12H20M4 12L7 9M4 12L7 15M20 12L17 9M20 12L17 15" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  return `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none"><g transform="rotate(${deg} 12 12)">${arrow}</g></svg>`,
  )}`;
}

/** SVG data URL for the rotation cursor */
export function rotateCursorSVG(color: string): string {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
      <g transform="scale(0.75) translate(3, 3)">
        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3456 3 16.4922 3.93392 18.1243 5.43938" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M17 3L18.1243 5.43938L15.5 6.5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${color}"/>
        <circle cx="12" cy="12" r="2" fill="${color}"/>
      </g>
    </svg>`)}`;
}

/**
 * Test if a normalized cursor point is within hitRadiusPx of the ellipse edge.
 */
export function hitTestEllipseEdge(
  point: Point,
  centroid: Point,
  radiusX: number,
  radiusY: number,
  angle: number,
  w: number,
  h: number,
  hitRadiusPx: number,
  viewportScale: number = 1,
): boolean {
  // Inverse-rotate the point around centroid so we can test against unrotated ellipse
  const unrotated = inverseRotatePointN(point, centroid, angle, w, h);

  const [cx, cy] = centroid;
  const [px, py] = unrotated;
  const dx = px - cx;
  const dy = py - cy;

  if (radiusX <= 0 || radiusY <= 0) return false;

  // Distance from point to ellipse edge (approximated)
  const anglePoint = Math.atan2(dy, dx);
  const ex = radiusX * Math.cos(anglePoint);
  const ey = radiusY * Math.sin(anglePoint);
  const edgePxX = ex * w;
  const edgePxY = ey * h;
  const pxPx = dx * w;
  const pyPx = dy * h;
  const distPx = Math.sqrt((pxPx - edgePxX) ** 2 + (pyPx - edgePxY) ** 2);

  return distPx * viewportScale < hitRadiusPx;
}

/**
 * Test if a normalized cursor point is inside the ellipse body.
 */
export function pointInEllipse(
  point: Point,
  centroid: Point,
  radiusX: number,
  radiusY: number,
  angle: number,
  w: number,
  h: number,
): boolean {
  const unrotated = inverseRotatePointN(point, centroid, angle, w, h);
  const [cx, cy] = centroid;
  const dx = unrotated[0] - cx;
  const dy = unrotated[1] - cy;

  if (radiusX <= 0 || radiusY <= 0) return false;

  const val = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
  return val <= 1;
}
