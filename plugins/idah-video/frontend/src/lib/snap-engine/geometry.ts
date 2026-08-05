// ---------------------------------------------------------------------------
// snap-engine/geometry.ts — Pure geometry primitives for snapping
//
// All coordinates are in the same unit space (normalized 0-1 or canvas
// units — callers must ensure consistency). Functions are stateless and
// independently testable.
// ---------------------------------------------------------------------------

import type { Point, Segment, CircleArc } from "./index";

// ─── Point-on-segment nearest point ────────────────────────────────────

/**
 * Returns the closest point on segment `seg` to point `p`, and the
 * squared distance.
 */
export function nearestPointOnSegment(
  p: Point,
  seg: Segment,
): { point: Point; distSq: number } {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  const [px, py] = p;

  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;

  if (lenSq === 0) {
    // Degenerate segment: just the point
    const dx = px - ax;
    const dy = py - ay;
    return { point: [ax, ay], distSq: dx * dx + dy * dy };
  }

  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nx = ax + t * abx;
  const ny = ay + t * aby;
  const dx = px - nx;
  const dy = py - ny;
  return { point: [nx, ny], distSq: dx * dx + dy * dy };
}

// ─── Ellipse nearest point (iterative Newton) ──────────────────────────

/**
 * Returns the closest point on the ellipse boundary to `p`, and the
 * squared distance.
 *
 * Uses Newton's method on the ellipse's parametric form:
 *   P(θ) = center + Rot(rotation) · (rx·cosθ, ry·sinθ)
 *
 * 4–5 iterations is sufficient for cursor-snapping accuracy.
 */
export function nearestPointOnEllipse(
  p: Point,
  arc: CircleArc,
  iterations: number = 5,
): { point: Point; distSq: number } {
  const [cx, cy] = arc.center;
  const { rx, ry, rotation } = arc;
  const [px, py] = p;

  // Translate cursor to ellipse-local (center at origin)
  const lx = px - cx;
  const ly = py - cy;

  // Rotate into ellipse-local axis-aligned frame
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);
  const u = lx * cosR - ly * sinR;
  const v = lx * sinR + ly * cosR;

  // Initial guess: project cursor onto unit circle scaled by radii
  const dist = Math.sqrt(u * u + v * v);
  let theta: number;
  if (dist < 1e-10) {
    theta = 0; // cursor at center — start at angle 0
  } else {
    theta = Math.atan2(v / ry, u / rx);
  }

  // Newton iteration: minimize f(θ) = rx²cos²θ(?)...
  // Actually minimize distance² = (rx·cosθ - u)² + (ry·sinθ - v)²
  // f(θ)   = (rx·cosθ - u)² + (ry·sinθ - v)²
  // f'(θ)  = 2(rx·cosθ - u)(-rx·sinθ) + 2(ry·sinθ - v)(ry·cosθ)
  //         = 2[-rx·sinθ(rx·cosθ - u) + ry·cosθ(ry·sinθ - v)]
  //         = 2[(ry² - rx²)sinθ·cosθ + rx·u·sinθ - ry·v·cosθ]
  // f''(θ) = 2[(ry² - rx²)(cos²θ - sin²θ) + rx·u·cosθ + ry·v·sinθ]
  //
  // But let's use a simpler form. For ellipse:
  // P(θ) = (rx·cosθ, ry·sinθ)
  // f'(θ) = 2·P'(θ)·(P(θ) - cursor)
  // f''(θ) = 2·(P''(θ)·(P(θ) - cursor) + P'(θ)·P'(θ))
  //
  // P'(θ)  = (-rx·sinθ, ry·cosθ)
  // P''(θ) = (-rx·cosθ, -ry·sinθ)

  for (let i = 0; i < iterations; i++) {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);

    const ex = rx * ct;
    const ey = ry * st;

    // f'(θ)
    const ddx = -rx * st;
    const ddy = ry * ct;
    const df = 2 * (ddx * (ex - u) + ddy * (ey - v));

    // f''(θ)
    const dddx = -rx * ct;
    const dddy = -ry * st;
    const ddf =
      2 * (dddx * (ex - u) + dddy * (ey - v) + ddx * ddx + ddy * ddy);

    if (Math.abs(ddf) < 1e-12) break; // avoid division by zero

    const step = df / ddf;
    theta -= step;

    // Normalise to [0, 2π) to avoid drift
    theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  // Compute final point
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  let ex = rx * ct;
  let ey = ry * st;

  // Rotate back
  const cosRR = Math.cos(rotation);
  const sinRR = Math.sin(rotation);
  const nx = cx + ex * cosRR - ey * sinRR;
  const ny = cy + ex * sinRR + ey * cosRR;

  const dx = px - nx;
  const dy = py - ny;
  return { point: [nx, ny], distSq: dx * dx + dy * dy };
}

// ─── Point-to-vertex distance ──────────────────────────────────────────

/** Squared distance between two points. */
export function pointDistSq(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}
