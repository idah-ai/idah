// ---------------------------------------------------------------------------
// snap-engine/adapters/image.ts — Adapters for image-plugin shape kinds
//
// All adapters produce SnapGeometry in **scene pixel space** so that
// circles are truly circular and the coordinate system is uniform.
// The engine's threshold is in scene pixels.
// ---------------------------------------------------------------------------

import type { ShapeAdapter, SnapGeometry, Point } from "../index";
import {
  IMAGE_BOUNDING_BOX,
  IMAGE_POLYGON,
  IMAGE_LINE,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
} from "$lib/types";
import { media } from "$lib/state/media.svelte";

// ─── Conversion helpers ────────────────────────────────────────────────

/** Convert a normalized [0-1] point to scene pixel space. */
function toPx(p: Point): Point {
  return [p[0] * media.width, p[1] * media.height];
}

/** Rotate a point around a center by angle (radians). */
function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

/** Box: 4 corners → 4 segments + 4 vertices.
 *  Rotation is applied in pixel space (after scaling from normalized),
 *  so angle units are consistent regardless of aspect ratio.
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

/** Polygon: closed loop of N points → N segments + N vertices */
function polygonGeometry(points: Point[]): SnapGeometry {
  if (points.length < 2) return { segments: [], arcs: [], vertices: [] };
  const px = points.map(toPx);
  const segments = px.map((p, i) => ({
    a: p,
    b: px[(i + 1) % px.length],
  }));
  return { segments, arcs: [], vertices: px };
}

/** Line: 2 points → 1 segment + 2 vertices */
function lineGeometry(points: Point[]): SnapGeometry {
  if (points.length < 2) return { segments: [], arcs: [], vertices: [] };
  const px = points.map(toPx);
  return {
    segments: [{ a: px[0], b: px[1] }],
    arcs: [],
    vertices: px,
  };
}

/**
 * Circle: center + radius.
 *
 * The radius is stored normalized relative to min(w,h).
 * In pixel space: rx = ry = radius * min(w,h)
 */
function circleGeometry(center: Point, radius: number): SnapGeometry {
  const c = toPx(center);
  const r = radius * Math.min(media.width, media.height);
  return {
    segments: [],
    arcs: [{ center: c, rx: r, ry: r, rotation: 0 }],
    vertices: [c],
  };
}

/**
 * Ellipse: center + radii + rotation.
 *
 * The radii are stored normalized (relative to media dimensions).
 * In pixel space: rx = normalized_rx * w, ry = normalized_ry * h
 */
function ellipseGeometry(center: Point, radii: [number, number], rotation: number): SnapGeometry {
  const c = toPx(center);
  const rx = radii[0] * media.width;
  const ry = radii[1] * media.height;
  return {
    segments: [],
    arcs: [{ center: c, rx, ry, rotation }],
    vertices: [c],
  };
}

// ─── Shape adapters ───────────────────────────────────────────────────

export const boxAdapter: ShapeAdapter<{ points: Point[]; angle?: number }> = {
  toSnapGeometry(shape) {
    return boxGeometry(shape.points || [], shape.angle ?? 0);
  },
};

export const polygonAdapter: ShapeAdapter<{ points: Point[] }> = {
  toSnapGeometry(shape) {
    return polygonGeometry(shape.points || []);
  },
};

export const lineAdapter: ShapeAdapter<{ points: Point[] }> = {
  toSnapGeometry(shape) {
    return lineGeometry(shape.points || []);
  },
};

export const circleAdapter: ShapeAdapter<{ points: Point[]; radius?: number }> = {
  toSnapGeometry(shape) {
    const center = shape.points?.[0] ?? [0.5, 0.5];
    return circleGeometry(center, shape.radius ?? 0.1);
  },
};

export const ellipseAdapter: ShapeAdapter<{ points: Point[]; angle?: number }> = {
  toSnapGeometry(shape) {
    const center = shape.points?.[0] ?? [0.5, 0.5];
    const rx = shape.points?.[1]?.[0] ?? 0.1;
    const ry = shape.points?.[1]?.[1] ?? rx;
    return ellipseGeometry(center, [rx, ry], shape.angle ?? 0);
  },
};

// ─── Registry helper ──────────────────────────────────────────────────

import type { SnapEngine } from "../index";

export function registerImageAdapters(engine: SnapEngine): void {
  engine.registerAdapter(IMAGE_BOUNDING_BOX, boxAdapter);
  engine.registerAdapter(IMAGE_POLYGON, polygonAdapter);
  engine.registerAdapter(IMAGE_LINE, lineAdapter);
  engine.registerAdapter(IMAGE_CIRCLE, circleAdapter);
  engine.registerAdapter(IMAGE_ELLIPSE, ellipseAdapter);
}
