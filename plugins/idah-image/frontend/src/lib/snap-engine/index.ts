// ---------------------------------------------------------------------------
// snap-engine/index.ts — Magnetic snap engine
//
// Framework-agnostic. No Svelte/DOM dependency. Works in normalized 0-1
// coordinates (same space as the annotation shape model).
//
// Usage:
//   const engine = new SnapEngine();
//   engine.registerAdapter("idah-image:bounding-box", boxAdapter);
//   engine.registerAdapter("idah-image:polygon", polygonAdapter);
//   engine.setTargets(allAnnotationsOnCurrentFrame);
//   const snap = engine.querySnap(cursor, { thresholdPx, excludeShapeId, activeEdgeFrom });
//   if (snap) cursor = snap.point;
// ---------------------------------------------------------------------------

import {
  nearestPointOnSegment,
  nearestPointOnEllipse,
  segmentSegmentIntersection,
  segmentEllipseIntersections,
  pointDistSq,
} from "./geometry";
import { SpatialIndex, type IndexedItem } from "./spatial-index";

// ─── Types ──────────────────────────────────────────────────────────────

/** 2D point — same as the plugin's `Point` type. */
export type Point = [number, number];

/** A straight edge segment between two points. */
export interface Segment {
  a: Point;
  b: Point;
}

/** A circle or ellipse arc. For circles, rx === ry. */
export interface CircleArc {
  center: Point;
  rx: number;
  ry: number;
  rotation: number; // radians
}

/** Bounding box: [minX, minY, maxX, maxY]. */
export type BoundingBox = [number, number, number, number];

/**
 * A shape's boundary reduced to primitives the engine can snap to.
 * Adapters produce this from whatever native shape data a plugin uses.
 */
export interface SnapGeometry {
  segments: Segment[];
  arcs: CircleArc[];
  vertices: Point[];
}

/**
 * Adapter: converts a plugin's shape data into SnapGeometry primitives.
 */
export interface ShapeAdapter<TShape = unknown> {
  toSnapGeometry(shape: TShape): SnapGeometry;
}

/** Options for a snap query. */
export interface SnapQueryOptions {
  /** Snap threshold in canvas/workspace units (same unit as coordinates). */
  threshold: number;
  /** Shape id to ignore (the shape currently being drawn). */
  excludeShapeId?: string;
  /** If set, snaps to intersections between the in-progress edge and targets. */
  activeEdgeFrom?: Point;
}

/** The result of a successful snap query. */
export interface SnapResult {
  point: Point;
  kind: "vertex" | "edge" | "intersection";
  sourceShapeId?: string;
}

// ─── SnapEngine ────────────────────────────────────────────────────────

/**
 * The main snap engine. Owns a registry of per-shape-kind adapters and
 * a spatial index over the current set of target shapes.
 *
 * Thread-safe design notes: all state is set synchronously before queries
 * run. There is no async work. Call `setTargets()` when the annotation set
 * changes (e.g. on frame change for video), then call `querySnap()` on
 * each pointer move.
 */
export class SnapEngine {
  /** Per-shape-kind adapter registry. */
  private adapters = new Map<string, ShapeAdapter>();

  /** The spatial index over current target geometry. */
  private index = new SpatialIndex();

  /** The raw target list, keyed by shape id. */
  private targetShapes: { id: string; kind: string; data: unknown }[] = [];

  // ── Registry ────────────────────────────────────────────────────────

  /**
   * Register an adapter for a shape kind. Called once per shape kind
   * the plugin owns, at init time. Overwrites any previous adapter
   * for the same kind.
   */
  registerAdapter<TShape>(shapeKind: string, adapter: ShapeAdapter<TShape>): void {
    this.adapters.set(shapeKind, adapter as ShapeAdapter);
  }

  /** Unregister an adapter (e.g. when a plugin is disabled). */
  unregisterAdapter(shapeKind: string): void {
    this.adapters.delete(shapeKind);
  }

  // ── Target management ───────────────────────────────────────────────

  /**
   * Set the current set of shapes to snap against. Rebuilds the spatial
   * index. Unknown shape kinds are silently skipped.
   */
  setTargets(shapes: { id: string; kind: string; data: unknown }[]): void {
    this.targetShapes = shapes;

    const geometries: { shapeId: string; geometry: SnapGeometry }[] = [];

    for (const shape of shapes) {
      const adapter = this.adapters.get(shape.kind);
      if (!adapter) continue; // unknown kind — skip
      const geometry = adapter.toSnapGeometry(shape.data);
      geometries.push({ shapeId: shape.id, geometry });
    }

    this.index.rebuild(geometries);
  }

  /**
   * Returns the shapes currently set as targets (for external iteration,
   * e.g. when filtering for a frame update in video).
   */
  getTargets(): { id: string; kind: string; data: unknown }[] {
    return this.targetShapes;
  }

  // ── Query ───────────────────────────────────────────────────────────

  /**
   * Query the snap engine for the best snap candidate near `cursor`.
   * Returns null if nothing is within threshold.
   *
   * Priority: vertex > intersection > edge (vertices win when multiple
   * candidates are within threshold).
   */
  querySnap(cursor: Point, opts: SnapQueryOptions): SnapResult | null {
    // ── Gather candidates within threshold ──────────────────────────
    const candidates = this.index.query(cursor, opts.threshold);

    if (candidates.length === 0) return null;

    const thresholdSq = opts.threshold * opts.threshold;

    let bestVertex: { point: Point; distSq: number; shapeId: string } | null = null;
    let bestEdge: { point: Point; distSq: number; shapeId: string } | null = null;
    let bestIntersection: { point: Point; distSq: number; shapeId: string } | null = null;

    for (const item of candidates) {
      if (item.shapeId === opts.excludeShapeId) continue;

      switch (item.type) {
        case "vertex": {
          const vertex = item.data as Point;
          const dSq = pointDistSq(cursor, vertex);
          if (dSq < thresholdSq && (!bestVertex || dSq < bestVertex.distSq)) {
            bestVertex = { point: vertex, distSq: dSq, shapeId: item.shapeId };
          }
          break;
        }

        case "segment": {
          const seg = item.data as Segment;
          const result = nearestPointOnSegment(cursor, seg);
          if (result.distSq < thresholdSq && (!bestEdge || result.distSq < bestEdge.distSq)) {
            bestEdge = { point: result.point, distSq: result.distSq, shapeId: item.shapeId };
          }
          break;
        }

        case "arc": {
          const arc = item.data as CircleArc;
          const result = nearestPointOnEllipse(cursor, arc);
          if (result.distSq < thresholdSq && (!bestEdge || result.distSq < bestEdge.distSq)) {
            bestEdge = { point: result.point, distSq: result.distSq, shapeId: item.shapeId };
          }
          break;
        }
      }
    }

    // ── Check intersections with the active edge ────────────────────
    // Only if activeEdgeFrom is set AND no vertex is already winning,
    // since vertices have highest priority.
    if (opts.activeEdgeFrom && !bestVertex) {
      const activeSeg: Segment = { a: opts.activeEdgeFrom, b: cursor };

      for (const item of candidates) {
        if (item.shapeId === opts.excludeShapeId) continue;

        // Segment–segment intersections
        if (item.type === "segment") {
          const seg = item.data as Segment;
          const intersection = segmentSegmentIntersection(activeSeg, seg);
          if (intersection) {
            const dSq = pointDistSq(cursor, intersection);
            if (dSq < thresholdSq && (!bestIntersection || dSq < bestIntersection.distSq)) {
              bestIntersection = { point: intersection, distSq: dSq, shapeId: item.shapeId };
            }
          }
        }

        // Segment–arc intersections
        if (item.type === "arc") {
          const arc = item.data as CircleArc;
          const intersections = segmentEllipseIntersections(activeSeg, arc);
          for (const intersection of intersections) {
            const dSq = pointDistSq(cursor, intersection);
            if (dSq < thresholdSq && (!bestIntersection || dSq < bestIntersection.distSq)) {
              bestIntersection = { point: intersection, distSq: dSq, shapeId: item.shapeId };
            }
          }
        }
      }
    }

    // ── Select winner by priority ───────────────────────────────────
    // Priority: vertex > intersection > edge
    if (bestVertex) {
      return { point: bestVertex.point, kind: "vertex", sourceShapeId: bestVertex.shapeId };
    }
    if (bestIntersection) {
      return { point: bestIntersection.point, kind: "intersection", sourceShapeId: bestIntersection.shapeId };
    }
    if (bestEdge) {
      return { point: bestEdge.point, kind: "edge", sourceShapeId: bestEdge.shapeId };
    }

    return null;
  }
}
