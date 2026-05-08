// ---------------------------------------------------------------------------
// math/geometry.ts — General geometry helpers (kept for backward compat)
//
// Most functions here have moved to math/point.ts or math/bbox.ts.
// This file re-exports them so existing imports still work.
// ---------------------------------------------------------------------------

export { centroid } from "$lib/utils/math/point";

export type { Point } from "$lib/utils/math/point";
export {
  dot,
  sub,
  add,
  scale,
  distance,
  midpoint,
  projectPointOnSegment,
  circularDistance,
  rotatePoint,
} from "$lib/utils/math/point";
