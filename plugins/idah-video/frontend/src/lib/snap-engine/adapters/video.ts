// ---------------------------------------------------------------------------
// snap-engine/adapters/video.ts — Adapters for video-plugin shape kinds
//
// All adapters produce SnapGeometry in **scene pixel space**.
// The caller resolves interpolated frame geometry from keyframes before
// passing to the snap engine.
// ---------------------------------------------------------------------------

import type { ShapeAdapter, SnapGeometry, Point } from "../index";
import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";
import { media } from "$lib/state/media.svelte";

// ─── Conversion helpers ────────────────────────────────────────────────

function toPx(p: Point): Point {
  return [p[0] * media.width, p[1] * media.height];
}

function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

/**
 * Box: 4 corners → 4 segments + 4 vertices.
 * The `points` field stores axis-aligned corners; `angle` is applied
 * as a rotation around the centroid during rendering.
 */
function boxGeometry(points: Point[], angle: number): SnapGeometry {
  if (points.length < 4) return { segments: [], arcs: [], vertices: [] };

  const px = points.map(toPx);

  // Apply rotation around centroid in pixel space
  let rotated: Point[];
  if (angle !== 0) {
    const cx = px.reduce((s, p) => s + p[0], 0) / px.length;
    const cy = px.reduce((s, p) => s + p[1], 0) / px.length;
    rotated = px.map((p) => rotatePoint(p, [cx, cy], angle));
  } else {
    rotated = px;
  }
  const segments = [
    { a: rotated[0], b: rotated[1] },
    { a: rotated[1], b: rotated[2] },
    { a: rotated[2], b: rotated[3] },
    { a: rotated[3], b: rotated[0] },
  ];
  return { segments, arcs: [], vertices: rotated };
}

function polygonGeometry(points: Point[]): SnapGeometry {
  if (points.length < 2) return { segments: [], arcs: [], vertices: [] };
  const px = points.map(toPx);
  const segments = px.map((p, i) => ({
    a: p,
    b: px[(i + 1) % px.length],
  }));
  return { segments, arcs: [], vertices: px };
}

// ─── Shape adapters ───────────────────────────────────────────────────

export const videoBoxAdapter: ShapeAdapter<{ points: Point[]; angle?: number }> = {
  toSnapGeometry(shape) {
    return boxGeometry(shape.points || [], shape.angle ?? 0);
  },
};

export const videoPolygonAdapter: ShapeAdapter<{ points: Point[] }> = {
  toSnapGeometry(shape) {
    return polygonGeometry(shape.points || []);
  },
};

// ─── Registry helper ──────────────────────────────────────────────────

import type { SnapEngine } from "../index";

export function registerVideoAdapters(engine: SnapEngine): void {
  engine.registerAdapter(VIDEO_BOUNDING_BOX, videoBoxAdapter);
  engine.registerAdapter(VIDEO_POLYGON, videoPolygonAdapter);
}
