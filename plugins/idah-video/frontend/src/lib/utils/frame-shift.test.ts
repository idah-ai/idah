// ---------------------------------------------------------------------------
// frame-shift.test.ts — Unit tests for shiftAndClampShape
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { shiftAndClampShape } from "./frame-shift";
import type { IVideoAnnotationShape } from "$lib/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeShape(overrides: Partial<IVideoAnnotationShape> = {}): IVideoAnnotationShape {
  return {
    type: "idah-video:bounding-box",
    start: 10,
    end: 20,
    frames: [
      { frame: 10, angle: 0, points: [[0, 0], [100, 100]] },
      { frame: 15, angle: 0.1, points: [[10, 10], [90, 90]] },
      { frame: 20, angle: 0, points: [[20, 20], [80, 80]] },
    ],
    ...overrides,
  };
}

const MIN = 0;
const MAX = 100;

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("shiftAndClampShape", () => {
  it("no shift (delta=0) returns identical frames/start/end", () => {
    const shape = makeShape();
    const result = shiftAndClampShape(shape, 0, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(shape.start);
    expect(result.end).toBe(shape.end);
    expect(result.frames).toHaveLength(shape.frames.length);
    result.frames.forEach((f, i) => {
      expect(f.frame).toBe(shape.frames[i].frame);
      expect(f.angle).toBe(shape.frames[i].angle);
      expect(f.points).toEqual(shape.frames[i].points);
    });
  });

  it("shift fully inside bounds shifts all frames by delta", () => {
    const shape = makeShape();
    const delta = 5;
    const result = shiftAndClampShape(shape, delta, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(shape.start + delta);   // 15
    expect(result.end).toBe(shape.end + delta);         // 25
    expect(result.frames).toHaveLength(shape.frames.length);
    result.frames.forEach((f, i) => {
      expect(f.frame).toBe(shape.frames[i].frame + delta);
      expect(f.points).toEqual(shape.frames[i].points); // spatial unchanged
    });
  });

  it("shift low end negative — synthesizes keyframe at frame 0", () => {
    // shape starts at 10, shift by -15 → shiftedStart = -5 (clips)
    const shape = makeShape();
    const delta = -15;
    const result = shiftAndClampShape(shape, delta, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(0); // clamped to minFrame
    // Original end 20 + (-15) = 5
    expect(result.end).toBe(5);

    // Should have a synthesized keyframe at frame 0
    const frame0 = result.frames.find((f) => f.frame === 0);
    expect(frame0).toBeDefined();
    expect(frame0!.points.length).toBeGreaterThan(0);

    // All frames should be >= 0
    result.frames.forEach((f) => {
      expect(f.frame).toBeGreaterThanOrEqual(MIN);
    });
  });

  it("shift high end exceeds MAX — synthesizes keyframe at MAX", () => {
    // shape ends at 20, shift by 90 → shiftedEnd = 110 (clips past MAX=100)
    const shape = makeShape();
    const delta = 90;
    const result = shiftAndClampShape(shape, delta, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.end).toBe(MAX);
    expect(result.start).toBe(shape.start + delta); // 100

    // Should have a synthesized keyframe at frame MAX
    const frameMax = result.frames.find((f) => f.frame === MAX);
    expect(frameMax).toBeDefined();
    expect(frameMax!.points.length).toBeGreaterThan(0);

    // All frames should be <= MAX
    result.frames.forEach((f) => {
      expect(f.frame).toBeLessThanOrEqual(MAX);
    });
  });

  it("entirely out of bounds returns outOfBounds: true", () => {
    const shape = makeShape({ start: 10, end: 20 });
    // Shift far negative so the whole range is < 0
    const result = shiftAndClampShape(shape, -50, MIN, MAX);
    expect(result.outOfBounds).toBe(true);
    expect(result.frames).toHaveLength(0);

    // Shift far positive so the whole range is > MAX
    const result2 = shiftAndClampShape(shape, 200, MIN, MAX);
    expect(result2.outOfBounds).toBe(true);
    expect(result2.frames).toHaveLength(0);
  });

  it("single-keyframe shape shifted to a bound exactly — no duplicate", () => {
    // Single keyframe at frame 10, shift by -10 → lands exactly on frame 0
    const shape = makeShape({
      start: 10,
      end: 10,
      frames: [{ frame: 10, angle: 0, points: [[50, 50]] }],
    });
    const result = shiftAndClampShape(shape, -10, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].frame).toBe(0);
    expect(result.frames[0].points).toEqual([[50, 50]]);
  });

  it("single-keyframe shape shifted past a bound — outOfBounds", () => {
    // Single keyframe at frame 10, shift by -20 → lands at -10, out of bounds
    const shape = makeShape({
      start: 10,
      end: 10,
      frames: [{ frame: 10, angle: 0, points: [[50, 50]] }],
    });
    const result = shiftAndClampShape(shape, -20, MIN, MAX);
    expect(result.outOfBounds).toBe(true);
    expect(result.frames).toHaveLength(0);
  });

  it("shift that lands exactly on the bound with an existing keyframe — no duplicate", () => {
    // shape has a keyframe at frame 10, shift by -10 → lands on frame 0.
    // Also add an explicit keyframe at frame 0 in the original shape (after shift).
    // Actually let's test: shape has keyframes at 10 and 20, shift by -10 → 0 and 10.
    // Frame 0 already exists as a shifted keyframe, so no synthesis.
    const shape = makeShape({
      start: 10,
      end: 20,
      frames: [
        { frame: 10, angle: 0, points: [[0, 0]] },
        { frame: 20, angle: 0, points: [[100, 100]] },
      ],
    });
    const result = shiftAndClampShape(shape, -10, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(0);
    expect(result.frames).toHaveLength(2);
    // Both frames should be shifted, no extra synthesized frame
    expect(result.frames[0].frame).toBe(0);
    expect(result.frames[1].frame).toBe(10);
  });

  it("both ends clip simultaneously — synthesizes at both bounds", () => {
    // shape covers [10, 90], shift by -20 → [-10, 70] → clips low at 0
    // and shift by 20 → [30, 110] → clips high at MAX.
    // To trigger both, we need a shape that after shift is wider than [0, MAX].
    // Let's make shape cover [0, 200] with delta=0 → already clips at MAX.
    const shape = makeShape({
      start: 0,
      end: 200,
      frames: [
        { frame: 0, angle: 0, points: [[0, 0]] },
        { frame: 100, angle: 0, points: [[50, 50]] },
        { frame: 200, angle: 0, points: [[100, 100]] },
      ],
    });
    const result = shiftAndClampShape(shape, 0, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(0);
    expect(result.end).toBe(MAX);
    // Should have keyframes at 0 and MAX (both already exist as shifted originals)
    expect(result.frames.some((f) => f.frame === 0)).toBe(true);
    expect(result.frames.some((f) => f.frame === MAX)).toBe(true);
    // No frame outside bounds
    result.frames.forEach((f) => {
      expect(f.frame).toBeGreaterThanOrEqual(MIN);
      expect(f.frame).toBeLessThanOrEqual(MAX);
    });
  });

  it("polygon shape — getInterpolatedFrame is exercised", () => {
    const shape = makeShape({
      type: "idah-video:polygon",
      start: 10,
      end: 20,
      frames: [
        { frame: 10, angle: 0, points: [[0, 0], [10, 10], [20, 20]] },
        { frame: 20, angle: 0, points: [[30, 30], [40, 40], [50, 50]] },
      ],
    });
    // Shift so low end clips, forcing interpolation
    const delta = -15;
    const result = shiftAndClampShape(shape, delta, MIN, MAX);

    expect(result.outOfBounds).toBe(false);
    expect(result.start).toBe(0);
    // Synthesized frame at 0 should have 3 points (polygon)
    const frame0 = result.frames.find((f) => f.frame === 0);
    expect(frame0).toBeDefined();
    expect(frame0!.points).toHaveLength(3);
  });

  it("empty frames array returns outOfBounds", () => {
    const shape = makeShape({ frames: [] });
    const result = shiftAndClampShape(shape, 0, MIN, MAX);
    // No frames means no keyframes — the helper reports outOfBounds.
    expect(result.frames).toHaveLength(0);
    expect(result.outOfBounds).toBe(true);
  });
});