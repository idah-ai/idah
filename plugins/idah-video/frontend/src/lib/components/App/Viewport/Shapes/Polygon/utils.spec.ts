// ---------------------------------------------------------------------------
// Polygon/utils.spec.ts — Unit tests for polygon utility functions
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  polygonVertexHandles,
  polygonEdgeMidpoints,
  polygonCentroid,
  pointInPolygon,
  hitTestVertex,
  hitTestEdgeMidpoint,
  moveVertex,
  addVertexOnEdge,
} from "./utils";

// ─── polygonVertexHandles ─────────────────────────────────────────────────

describe("polygonVertexHandles", () => {
  it("returns the same points as handles", () => {
    const pts: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.3, 0.8],
    ];
    expect(polygonVertexHandles(pts)).toBe(pts);
    expect(polygonVertexHandles(pts)).toEqual(pts);
  });

  it("returns empty array for empty input", () => {
    expect(polygonVertexHandles([])).toEqual([]);
  });
});

// ─── polygonEdgeMidpoints ─────────────────────────────────────────────────

describe("polygonEdgeMidpoints", () => {
  it("returns midpoints for each edge of a triangle", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    const midpoints = polygonEdgeMidpoints(pts);
    expect(midpoints).toHaveLength(3);
    expect(midpoints[0]).toEqual([0.5, 0]);   // edge 0→1
    expect(midpoints[1]).toEqual([0.5, 0.5]); // edge 1→2
    expect(midpoints[2]).toEqual([0, 0.5]);   // edge 2→0
  });

  it("returns midpoints for a quadrilateral (4 points)", () => {
    const pts: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ];
    const midpoints = polygonEdgeMidpoints(pts);
    expect(midpoints).toHaveLength(4);
    expect(midpoints[0]).toEqual([0.3, 0.2]); // edge 0→1
    expect(midpoints[1]).toEqual([0.5, 0.4]); // edge 1→2
    expect(midpoints[2]).toEqual([0.3, 0.6]); // edge 2→3
    expect(midpoints[3]).toEqual([0.1, 0.4]); // edge 3→0
  });

  it("returns empty array for fewer than 2 points", () => {
    expect(polygonEdgeMidpoints([[0, 0]])).toEqual([]);
    expect(polygonEdgeMidpoints([])).toEqual([]);
  });

  it("returns one midpoint for 2 points (degenerate polygon edge)", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const midpoints = polygonEdgeMidpoints(pts);
    expect(midpoints).toHaveLength(2);
    expect(midpoints[0]).toEqual([0.5, 0]); // edge 0→1
    expect(midpoints[1]).toEqual([0.5, 0]); // edge 1→0 (wrap-around)
  });
});

// ─── polygonCentroid ──────────────────────────────────────────────────────

describe("polygonCentroid", () => {
  it("computes centroid of a triangle", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    const c = polygonCentroid(pts);
    expect(c[0]).toBeCloseTo(1 / 3);
    expect(c[1]).toBeCloseTo(1 / 3);
  });

  it("computes centroid of a square", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const c = polygonCentroid(pts);
    expect(c[0]).toBeCloseTo(0.5);
    expect(c[1]).toBeCloseTo(0.5);
  });

  it("returns [0, 0] for empty array", () => {
    expect(polygonCentroid([])).toEqual([0, 0]);
  });

  it("handles a single point", () => {
    expect(polygonCentroid([[0.3, 0.7]])).toEqual([0.3, 0.7]);
  });
});

// ─── pointInPolygon ───────────────────────────────────────────────────────

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  it("returns true for a point inside the polygon", () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
  });

  it("returns false for a point outside the polygon", () => {
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false);
  });

  it("returns false for a point clearly outside", () => {
    expect(pointInPolygon([-0.5, -0.5], square)).toBe(false);
  });

  it("handles a triangle", () => {
    const triangle: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    expect(pointInPolygon([0.25, 0.25], triangle)).toBe(true);
    expect(pointInPolygon([0.75, 0.75], triangle)).toBe(false);
  });

  it("handles a convex pentagon", () => {
    const pentagon: [number, number][] = [
      [0.5, 0],
      [1, 0.4],
      [0.8, 1],
      [0.2, 1],
      [0, 0.4],
    ];
    expect(pointInPolygon([0.5, 0.5], pentagon)).toBe(true);
    expect(pointInPolygon([0, 0], pentagon)).toBe(false);
  });
});

// ─── hitTestVertex ────────────────────────────────────────────────────────

describe("hitTestVertex", () => {
  const vertices: [number, number][] = [
    [0.1, 0.2],
    [0.5, 0.2],
    [0.5, 0.6],
    [0.1, 0.6],
  ];
  const W = 1920;
  const H = 1080;
  const RADIUS = 10; // pixels

  it("finds the correct vertex index when close", () => {
    // Vertex 0 at normalized [0.1, 0.2] → pixel [192, 216]
    // Hit at normalized [0.104, 0.204] → pixel [199.68, 220.32] → dx=7.68, dy=4.32 → ~8.8px < 10
    const idx = hitTestVertex([0.104, 0.204], vertices, W, H, RADIUS);
    expect(idx).toBe(0);
  });

  it("returns -1 when too far from any vertex", () => {
    const idx = hitTestVertex([0.5, 0.5], vertices, W, H, RADIUS);
    expect(idx).toBe(-1);
  });

  it("returns -1 for empty vertices", () => {
    const idx = hitTestVertex([0.5, 0.5], [], W, H, RADIUS);
    expect(idx).toBe(-1);
  });
});

// ─── hitTestEdgeMidpoint ─────────────────────────────────────────────────

describe("hitTestEdgeMidpoint", () => {
  const vertices: [number, number][] = [
    [0.1, 0.2],
    [0.5, 0.2],
    [0.5, 0.6],
    [0.1, 0.6],
  ];
  const W = 1920;
  const H = 1080;
  const RADIUS = 10;

  it("finds the correct edge midpoint index when close", () => {
    // Edge midpoint for edge 2→3 is [0.3, 0.6] → pixel [576, 648]
    // Hit at [0.302, 0.604] → dx=~3.8, dy=~4.3 → ~5.7px < 10
    const idx = hitTestEdgeMidpoint([0.302, 0.604], vertices, W, H, RADIUS);
    expect(idx).toBe(2);
  });

  it("returns -1 when too far from any edge midpoint", () => {
    // Point [0.5, 0.4] is exactly the midpoint of edge 1→2, so we pick a far point
    const idx = hitTestEdgeMidpoint([0.9, 0.9], vertices, W, H, RADIUS);
    expect(idx).toBe(-1);
  });

  it("returns -1 for empty vertices", () => {
    const idx = hitTestEdgeMidpoint([0.5, 0.5], [], W, H, RADIUS);
    expect(idx).toBe(-1);
  });
});

// ─── moveVertex ───────────────────────────────────────────────────────────

describe("moveVertex", () => {
  it("moves a vertex to a new position", () => {
    const vertices: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ];
    const result = moveVertex(vertices, 1, [0.7, 0.3]);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual([0.1, 0.2]);
    expect(result[1]).toEqual([0.7, 0.3]); // moved
    expect(result[2]).toEqual([0.5, 0.6]);
    expect(result[3]).toEqual([0.1, 0.6]);
  });

  it("moves the first vertex", () => {
    const vertices: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
    ];
    const result = moveVertex(vertices, 0, [0.9, 0.9]);
    expect(result[0]).toEqual([0.9, 0.9]);
    expect(result[1]).toEqual([0.5, 0.2]);
  });

  it("does not mutate the original array", () => {
    const vertices: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
    ];
    const copy = [...vertices];
    moveVertex(vertices, 0, [0.9, 0.9]);
    expect(vertices).toEqual(copy);
  });
});

// ─── addVertexOnEdge ──────────────────────────────────────────────────────

describe("addVertexOnEdge", () => {
  it("inserts a vertex at the midpoint of the specified edge", () => {
    const vertices: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ];
    const result = addVertexOnEdge(vertices, 1); // edge between vertex 1 and 2
    expect(result.vertices).toHaveLength(5);
    expect(result.insertedIndex).toBe(2);
    expect(result.vertices[0]).toEqual([0.1, 0.2]);
    expect(result.vertices[1]).toEqual([0.5, 0.2]); // vertex 1
    expect(result.vertices[2]).toEqual([0.5, 0.4]); // midpoint of edge 1→2
    expect(result.vertices[3]).toEqual([0.5, 0.6]); // vertex 2
    expect(result.vertices[4]).toEqual([0.1, 0.6]);
  });

  it("inserts at the wrap-around edge (last→first)", () => {
    const vertices: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
    ];
    const result = addVertexOnEdge(vertices, 2); // edge between vertex 2 and 0
    expect(result.insertedIndex).toBe(3);
    expect(result.vertices[3]).toEqual([0.3, 0.4]); // midpoint of edge 2→0
  });

  it("returns { vertices, insertedIndex: -1 } for fewer than 2 points", () => {
    const result = addVertexOnEdge([[0.1, 0.2]], 0);
    expect(result.vertices).toEqual([[0.1, 0.2]]);
    expect(result.insertedIndex).toBe(-1);
  });

  it("does not mutate the original array", () => {
    const vertices: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const copy = [...vertices];
    addVertexOnEdge(vertices, 0);
    expect(vertices).toEqual(copy);
  });
});