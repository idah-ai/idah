import { rotatePoint, type Point } from "$lib/utils/math/point";

/** Generate 8 handle positions: 4 corners + 4 edge midpoints in order [tl, tm, tr, mr, br, bm, bl, ml] */
export function boundingBoxHandle(pts: Point[]): Point[] {
  if (pts.length !== 4) return [];
  const handles: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    handles.push(pts[i]);
    handles.push([(pts[i][0] + pts[next][0]) / 2, (pts[i][1] + pts[next][1]) / 2]);
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
      ? `<path d="M8 8L4 4M4 4H8M4 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16L20 20M20 20H16M20 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : type === "nesw-resize"
        ? `<path d="M16 8L20 4M20 4H16M20 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16L4 20M4 20H8M4 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        : type === "ns-resize"
          ? `<path d="M12 4V20M12 4L9 7M12 4L15 7M12 20L9 17M12 20L15 17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<path d="M4 12H20M4 12L7 9M4 12L7 15M20 12L17 9M20 12L17 15" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

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
