// ---------------------------------------------------------------------------
// snap-engine/spatial-index.ts — Density-based uniform grid spatial index
//
// Grid resolution is derived from FIXED world bounds (media pixel
// dimensions) and item count — never from the bounding box of the shapes
// themselves. This avoids degenerate cell sizes when shapes are clustered
// or when a single outlier shape sits far from the rest.
//
// Storage uses a flat array indexed by (cy * cellsX + cx) rather than a
// Map keyed by string concatenation, since this rebuilds on every
// setTargets() call and plain array indexing is materially faster.
//
// Rebuilt on demand via `rebuild()`, never incrementally updated.
// ---------------------------------------------------------------------------

import type { SnapGeometry, Segment, CircleArc, BoundingBox } from "./index";

type Point = [number, number];

const MIN_GRID_RES = 4;
const MAX_GRID_RES = 64;
/** Target average items per cell — classic spatial-hashing rule of thumb. */
const TARGET_ITEMS_PER_CELL = 4;

export interface IndexedItem {
  type: "segment" | "arc" | "vertex";
  data: Segment | CircleArc | Point;
  bbox: BoundingBox;
  shapeId: string;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class SpatialIndex {
  private cellsX = MIN_GRID_RES;
  private cellsY = MIN_GRID_RES;
  private cellW = 1;
  private cellH = 1;
  private worldW = 1;
  private worldH = 1;

  /** Flat array of buckets. Index = cy * cellsX + cx. Sparse — buckets stay undefined until first insert. */
  private cells: (IndexedItem[] | undefined)[] = [];
  private _items: IndexedItem[] = [];

  /**
   * Rebuild the grid.
   *
   * @param worldWidth  Fixed world width in the same units as shape
   *                    coordinates (i.e. `media.width` for scene-pixel
   *                    space). NOT derived from shape positions.
   * @param worldHeight Fixed world height, same units.
   */
  rebuild(
    shapeGeometries: { shapeId: string; geometry: SnapGeometry }[],
    worldWidth: number,
    worldHeight: number,
  ): void {
    this._items = [];

    for (const { shapeId, geometry } of shapeGeometries) {
      for (const seg of geometry.segments) {
        this._items.push({ type: "segment", data: seg, bbox: segmentBbox(seg), shapeId });
      }
      for (const arc of geometry.arcs) {
        this._items.push({ type: "arc", data: arc, bbox: arcBbox(arc), shapeId });
      }
      for (const vertex of geometry.vertices) {
        const bbox: BoundingBox = [vertex[0], vertex[1], vertex[0], vertex[1]];
        this._items.push({ type: "vertex", data: vertex, bbox, shapeId });
      }
    }

    this.worldW = Math.max(worldWidth, 1e-6);
    this.worldH = Math.max(worldHeight, 1e-6);

    // Resolution scales with sqrt(item count) so average items/cell stays
    // roughly constant (~TARGET_ITEMS_PER_CELL) regardless of clustering.
    const res = Math.round(Math.sqrt(this._items.length / TARGET_ITEMS_PER_CELL));
    const gridRes = clampInt(res || MIN_GRID_RES, MIN_GRID_RES, MAX_GRID_RES);

    this.cellsX = gridRes;
    this.cellsY = gridRes;
    this.cellW = this.worldW / gridRes;
    this.cellH = this.worldH / gridRes;
    this.cells = new Array(this.cellsX * this.cellsY);

    for (const item of this._items) {
      const [bminX, bminY, bmaxX, bmaxY] = item.bbox;
      const cMinX = clampInt(Math.floor(bminX / this.cellW), 0, this.cellsX - 1);
      const cMinY = clampInt(Math.floor(bminY / this.cellH), 0, this.cellsY - 1);
      const cMaxX = clampInt(Math.floor(bmaxX / this.cellW), 0, this.cellsX - 1);
      const cMaxY = clampInt(Math.floor(bmaxY / this.cellH), 0, this.cellsY - 1);

      for (let cy = cMinY; cy <= cMaxY; cy++) {
        const rowBase = cy * this.cellsX;
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          const idx = rowBase + cx;
          const bucket = this.cells[idx];
          if (bucket) {
            bucket.push(item);
          } else {
            this.cells[idx] = [item];
          }
        }
      }
    }
  }

  /**
   * Return candidate items whose bbox overlaps the query region around
   * `point` within `radius`.
   */
  query(point: Point, radius: number): IndexedItem[] {
    const [px, py] = point;
    const results = new Set<IndexedItem>();

    const qMinX = px - radius;
    const qMinY = py - radius;
    const qMaxX = px + radius;
    const qMaxY = py + radius;

    const cMinX = clampInt(Math.floor(qMinX / this.cellW), 0, this.cellsX - 1);
    const cMinY = clampInt(Math.floor(qMinY / this.cellH), 0, this.cellsY - 1);
    const cMaxX = clampInt(Math.floor(qMaxX / this.cellW), 0, this.cellsX - 1);
    const cMaxY = clampInt(Math.floor(qMaxY / this.cellH), 0, this.cellsY - 1);

    for (let cy = cMinY; cy <= cMaxY; cy++) {
      const rowBase = cy * this.cellsX;
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        const bucket = this.cells[rowBase + cx];
        if (!bucket) continue;
        for (const item of bucket) {
          const [bminX, bminY, bmaxX, bmaxY] = item.bbox;
          if (qMaxX >= bminX && qMinX <= bmaxX && qMaxY >= bminY && qMinY <= bmaxY) {
            results.add(item);
          }
        }
      }
    }

    return [...results];
  }

  /** All items (for debug/tests). */
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
  const maxR = Math.max(rx, ry);
  return [cx - maxR, cy - maxR, cx + maxR, cy + maxR];
}
