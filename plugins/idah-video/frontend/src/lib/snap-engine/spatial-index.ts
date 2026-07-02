// ---------------------------------------------------------------------------
// snap-engine/spatial-index.ts — Uniform grid spatial index
//
// Buckets segments and arcs into grid cells for fast neighbourhood queries.
// Rebuilt on demand via `rebuild()`, never incrementally updated.
// ---------------------------------------------------------------------------

import type { SnapGeometry, Segment, CircleArc, BoundingBox } from "./index";

/** Default grid: 10×10 cells. Fine enough for ~100 shapes; cheap to build. */
const DEFAULT_GRID_SIZE = 10;

export interface IndexedItem {
  type: "segment" | "arc" | "vertex";
  /** The original geometry element */
  data: Segment | CircleArc | Point;
  /** Bounding box for quick broad-phase checks */
  bbox: BoundingBox;
  /** The shape's id (for exclusion) */
  shapeId: string;
}

type Point = [number, number];

class BoundsAccum {
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  expand(bbox: BoundingBox): void {
    this.minX = Math.min(this.minX, bbox[0]);
    this.minY = Math.min(this.minY, bbox[1]);
    this.maxX = Math.max(this.maxX, bbox[2]);
    this.maxY = Math.max(this.maxY, bbox[3]);
  }
}

export class SpatialIndex {
  private gridSize: number;
  private cells: Map<string, IndexedItem[]> = new Map();
  private _items: IndexedItem[] = [];

  /** Stored so query() can compute cell membership without iterating all items. */
  private originX = 0;
  private originY = 0;
  private cellW = 1;
  private cellH = 1;

  constructor(gridSize: number = DEFAULT_GRID_SIZE) {
    this.gridSize = gridSize;
  }

  /**
   * Rebuild the grid from an array of SnapGeometry targets.
   * Each SnapGeometry is enriched with its `shapeId`.
   */
  rebuild(shapeGeometries: { shapeId: string; geometry: SnapGeometry }[]): void {
    this.cells.clear();
    this._items = [];

    const bounds = new BoundsAccum();

    // First pass: collect all items and compute world bounds
    for (const { shapeId, geometry } of shapeGeometries) {
      for (const seg of geometry.segments) {
        const bbox = segmentBbox(seg);
        this._items.push({ type: "segment", data: seg, bbox, shapeId });
        bounds.expand(bbox);
      }
      for (const arc of geometry.arcs) {
        const bbox = arcBbox(arc);
        this._items.push({ type: "arc", data: arc, bbox, shapeId });
        bounds.expand(bbox);
      }
      for (const vertex of geometry.vertices) {
        const bbox: BoundingBox = [vertex[0], vertex[1], vertex[0], vertex[1]];
        this._items.push({ type: "vertex", data: vertex, bbox, shapeId });
        bounds.expand(bbox);
      }
    }

    // Expand bounds slightly to avoid division by zero
    const bw = Math.max(bounds.maxX - bounds.minX, 1e-6);
    const bh = Math.max(bounds.maxY - bounds.minY, 1e-6);
    this.originX = bounds.minX;
    this.originY = bounds.minY;
    this.cellW = bw / this.gridSize;
    this.cellH = bh / this.gridSize;

    // Second pass: insert each item into its overlapping cells
    for (const item of this._items) {
      const [bminX, bminY, bmaxX, bmaxY] = item.bbox;
      const cMinX = Math.max(0, Math.floor((bminX - this.originX) / this.cellW));
      const cMinY = Math.max(0, Math.floor((bminY - this.originY) / this.cellH));
      const cMaxX = Math.min(this.gridSize - 1, Math.floor((bmaxX - this.originX) / this.cellW));
      const cMaxY = Math.min(this.gridSize - 1, Math.floor((bmaxY - this.originY) / this.cellH));

      for (let cy = cMinY; cy <= cMaxY; cy++) {
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          const key = `${cx}:${cy}`;
          let cell = this.cells.get(key);
          if (!cell) {
            cell = [];
            this.cells.set(key, cell);
          }
          cell.push(item);
        }
      }
    }
  }

  /**
   * Return candidate items whose bbox overlaps the query region around
   * `point` within `radius`. Uses the grid to cull distant cells.
   */
  query(point: Point, radius: number): IndexedItem[] {
    const [px, py] = point;
    const results = new Set<IndexedItem>();

    // Determine which cells overlap the query circle's axis-aligned bbox
    const qMinX = px - radius;
    const qMinY = py - radius;
    const qMaxX = px + radius;
    const qMaxY = py + radius;

    const cMinX = Math.max(0, Math.floor((qMinX - this.originX) / this.cellW));
    const cMinY = Math.max(0, Math.floor((qMinY - this.originY) / this.cellH));
    const cMaxX = Math.min(this.gridSize - 1, Math.floor((qMaxX - this.originX) / this.cellW));
    const cMaxY = Math.min(this.gridSize - 1, Math.floor((qMaxY - this.originY) / this.cellH));

    for (let cy = cMinY; cy <= cMaxY; cy++) {
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        const key = `${cx}:${cy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const item of cell) {
            // Broad-phase bbox check
            const [bminX, bminY, bmaxX, bmaxY] = item.bbox;
            if (
              qMaxX >= bminX && qMinX <= bmaxX &&
              qMaxY >= bminY && qMinY <= bmaxY
            ) {
              results.add(item);
            }
          }
        }
      }
    }

    return [...results];
  }

  /** All items (for full iteration when grid is too coarse). */
  get items(): IndexedItem[] {
    return this._items;
  }
}

// ─── Bounding box helpers ──────────────────────────────────────────────

function segmentBbox(seg: Segment): BoundingBox {
  return [
    Math.min(seg.a[0], seg.b[0]),
    Math.min(seg.a[1], seg.b[1]),
    Math.max(seg.a[0], seg.b[0]),
    Math.max(seg.a[1], seg.b[1]),
  ];
}

function arcBbox(arc: CircleArc): BoundingBox {
  const [cx, cy] = arc.center;
  const { rx, ry } = arc;
  // Approximate bbox — the ellipse may be rotated but this conservative
  // bbox is sufficient for broad-phase culling.
  const maxR = Math.max(rx, ry);
  return [cx - maxR, cy - maxR, cx + maxR, cy + maxR];
}
