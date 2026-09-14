// ---------------------------------------------------------------------------
// math/polylabel.ts — Polygon "visual center" (pole of inaccessibility)
//
// The vertex-average centroid drifts toward clusters of vertices and, on a
// concave shape (star, L, crescent), can fall outside the polygon entirely —
// so it is a poor anchor for an on-canvas label. This computes the pole of
// inaccessibility instead: the interior point furthest from any edge, which is
// always inside the shape and reads as its visual centre.
//
// Ported from Mapbox's polylabel (https://github.com/mapbox/polylabel, ISC),
// adapted to a single ring of `Point`s and a small inline priority queue.
//
// Operate in PIXEL space: callers pass points already scaled by (w, h) so the
// centre is visually correct on non-square media, where equal normalized steps
// in x and y are unequal on screen.
// ---------------------------------------------------------------------------
import { centroid, type Point } from "$lib/utils/math/point";

/**
 * Pole of inaccessibility — the interior point furthest from any polygon edge.
 *
 * @param ring       Polygon vertices (a single closed ring; the closing edge is implicit).
 * @param precision  Search stops once no cell can beat the best by more than this (px).
 */
export function polygonVisualCenter(ring: Point[], precision = 1): Point {
  // Fewer than 3 points can't bound an area — fall back to the plain average.
  if (ring.length < 3) return centroid(ring);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  // A flat (zero-area) ring: no interior to search, use its corner.
  if (cellSize === 0) return [minX, minY];

  const h = cellSize / 2;
  // Max-heap by `max`: the cell with the greatest distance potential pops first.
  const queue = new TinyQueue<Cell>((a, b) => b.max - a.max);

  // Cover the bounding box with a coarse grid of square cells.
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(new Cell(x + h, y + h, h, ring));
    }
  }

  // Seed with the area-weighted centroid and the bbox centre.
  let bestCell = getCentroidCell(ring);
  const bboxCell = new Cell(minX + width / 2, minY + height / 2, 0, ring);
  if (bboxCell.d > bestCell.d) bestCell = bboxCell;

  while (queue.length) {
    const cell = queue.pop()!;
    if (cell.d > bestCell.d) bestCell = cell;
    // Discard cells that cannot possibly contain a better centre.
    if (cell.max - bestCell.d <= precision) continue;

    // Otherwise split into four and keep searching.
    const hh = cell.h / 2;
    queue.push(new Cell(cell.x - hh, cell.y - hh, hh, ring));
    queue.push(new Cell(cell.x + hh, cell.y - hh, hh, ring));
    queue.push(new Cell(cell.x - hh, cell.y + hh, hh, ring));
    queue.push(new Cell(cell.x + hh, cell.y + hh, hh, ring));
  }

  return [bestCell.x, bestCell.y];
}

/** A candidate square: centre (x, y), half-size h, signed distance d to the ring. */
class Cell {
  x: number;
  y: number;
  h: number;
  /** Signed distance to the polygon: positive inside, negative outside. */
  d: number;
  /** Upper bound on the distance any point in this cell could have. */
  max: number;

  constructor(x: number, y: number, h: number, ring: Point[]) {
    this.x = x;
    this.y = y;
    this.h = h;
    this.d = pointToPolygonDist(x, y, ring);
    this.max = this.d + this.h * Math.SQRT2;
  }
}

/** Area-weighted centroid of the ring, as a zero-size cell (the search seed). */
function getCentroidCell(ring: Point[]): Cell {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    const f = ax * by - bx * ay;
    x += (ax + bx) * f;
    y += (ay + by) * f;
    area += f * 3;
  }
  if (area === 0) return new Cell(ring[0][0], ring[0][1], 0, ring);
  return new Cell(x / area, y / area, 0, ring);
}

/** Signed distance from (x, y) to the ring: positive when inside, negative outside. */
function pointToPolygonDist(x: number, y: number, ring: Point[]): number {
  let inside = false;
  let minDistSq = Infinity;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    minDistSq = Math.min(minDistSq, getSegDistSq(x, y, ring[i], ring[j]));
  }
  return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

/** Squared distance from point (px, py) to segment [a, b]. */
function getSegDistSq(px: number, py: number, a: Point, b: Point): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Minimal binary-heap priority queue — pops the element the comparator ranks first. */
class TinyQueue<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get length(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    let pos = this.data.length - 1;
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      if (this.compare(this.data[pos], this.data[parent]) >= 0) break;
      this.swap(pos, parent);
      pos = parent;
    }
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sink(0);
    }
    return top;
  }

  private sink(pos: number): void {
    const n = this.data.length;
    while (true) {
      const left = 2 * pos + 1;
      const right = left + 1;
      let best = pos;
      if (left < n && this.compare(this.data[left], this.data[best]) < 0) best = left;
      if (right < n && this.compare(this.data[right], this.data[best]) < 0) best = right;
      if (best === pos) break;
      this.swap(pos, best);
      pos = best;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.data[a];
    this.data[a] = this.data[b];
    this.data[b] = tmp;
  }
}
