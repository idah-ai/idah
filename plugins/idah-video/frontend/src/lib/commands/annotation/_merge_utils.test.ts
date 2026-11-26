// ---------------------------------------------------------------------------
// _merge_utils.test.ts — Unit tests for planMerge / canMerge / propertiesEqual
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { planMerge, canMerge, propertiesEqual } from "./_merge_utils";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockIsLocked = vi.hoisted(() => vi.fn<(...args: any[]) => boolean>(() => false));

vi.mock("$lib/state/annotation.svelte", () => ({
  annotation: { isLocked: mockIsLocked },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makePiece(id: string, start: number, end: number, overrides: Record<string, unknown> = {}): any {
  const frames = [];
  for (let f = start; f <= end; f++) {
    frames.push({
      frame: f,
      angle: 0,
      points: [
        [0, 0],
        [10, 10],
      ],
    });
  }
  return {
    id,
    shape_type: "idah-video:bounding-box",
    shape_args: { start, end, frames },
    category: "test/cat",
    ...overrides,
  };
}

/** Root piece — carries its group key as its own id (no group_id). */
function makeRoot(id: string, start: number, end: number, overrides: Record<string, unknown> = {}): any {
  return makePiece(id, start, end, overrides);
}

/** Child piece — carries the group key via metadata.group_id. */
function makeChild(
  id: string,
  groupId: string,
  start: number,
  end: number,
  overrides: Record<string, unknown> = {},
): any {
  return makePiece(id, start, end, { metadata: { group_id: groupId }, ...overrides });
}

beforeEach(() => {
  mockIsLocked.mockReset();
  mockIsLocked.mockReturnValue(false);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("planMerge — success", () => {
  it("merges two contiguous pieces", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    const plan = planMerge([a, b]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.survivor).toBe(a);
    expect(plan.absorbed).toEqual([b]);
    expect(plan.range).toEqual([0, 9]);
    expect(plan.merged.shape_args.start).toBe(0);
    expect(plan.merged.shape_args.end).toBe(9);
    expect(plan.merged.shape_args.frames.map((f: any) => f.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("merges three contiguous pieces", () => {
    const a = makeRoot("a", 0, 2);
    const b = makeChild("b", "a", 3, 5);
    const c = makeChild("c", "a", 6, 8);
    const plan = planMerge([a, b, c]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.range).toEqual([0, 8]);
    expect(plan.merged.shape_args.frames.map((f: any) => f.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("planMerge — rules 2–8", () => {
  it("fails rule 2 with fewer than two records", () => {
    const a = makeRoot("a", 0, 4);
    expect(planMerge([a])).toEqual({
      ok: false,
      reason: "Select at least two annotations to merge.",
    });
    expect(planMerge([])).toEqual({
      ok: false,
      reason: "Select at least two annotations to merge.",
    });
  });

  it("fails rule 3 with different groups", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "b", 5, 9);
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations belong to different groups.",
    });
  });

  it("fails rule 4 when a record is locked", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    mockIsLocked.mockImplementation((r: any) => r.id === "b");
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "One or more selected annotations are locked.",
    });
  });

  it("fails rule 5 with different shape types", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9, { shape_type: "idah-video:polygon" });
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations have different shape types.",
    });
  });

  it("fails rule 6 with different categories", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9, { category: "other/cat" });
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations have different categories.",
    });
  });

  it("fails rule 7 with different properties", () => {
    const a = makeRoot("a", 0, 4, { properties: { color: "red" } });
    const b = makeChild("b", "a", 5, 9, { properties: { color: "blue" } });
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations have different attributes.",
    });
  });

  it("fails rule 8 with a multi-frame gap (frames X–Y, 1-based)", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 7, 9); // gap at frames 6–7 (1-based: 6..7)
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations are not continuous (gap at frames 6–7).",
    });
  });

  it("fails rule 8 with a one-frame gap (frame X, 1-based)", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 6, 9); // gap at frame 6 (1-based)
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations are not continuous (gap at frame 6).",
    });
  });

  it("fails rule 8 with an overlap (frame N, 1-based)", () => {
    const a = makeRoot("a", 0, 5);
    const b = makeChild("b", "a", 4, 9); // overlap at frame 4 (1-based: 5)
    expect(planMerge([a, b])).toEqual({
      ok: false,
      reason: "Selected annotations overlap at frame 5.",
    });
  });
});

describe("propertiesEqual", () => {
  it("compares objects order-independently", () => {
    expect(propertiesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(propertiesEqual({ a: 1 }, { b: 2 })).toBe(false);
  });

  it("treats null, undefined and {} as equal", () => {
    expect(propertiesEqual(undefined, null)).toBe(true);
    expect(propertiesEqual(null, {})).toBe(true);
    expect(propertiesEqual(undefined, {})).toBe(true);
    expect(propertiesEqual({}, {})).toBe(true);
    expect(propertiesEqual({ a: 1 }, {})).toBe(false);
  });

  it("compares multi-select arrays as sets ignoring order and duplicates", () => {
    expect(propertiesEqual({ tags: ["a", "b", "a"] }, { tags: ["b", "a"] })).toBe(true);
    expect(propertiesEqual({ tags: ["a", "b"] }, { tags: ["a", "c"] })).toBe(false);
  });

  it("compares primitives with ===", () => {
    expect(propertiesEqual({ n: 1 }, { n: 1 })).toBe(true);
    expect(propertiesEqual({ n: 1 }, { n: 2 })).toBe(false);
  });
});

describe("planMerge — properties merge", () => {
  it("merges when properties are equal despite key order", () => {
    const a = makeRoot("a", 0, 4, { properties: { color: "red", size: 2 } });
    const b = makeChild("b", "a", 5, 9, { properties: { size: 2, color: "red" } });
    expect(planMerge([a, b]).ok).toBe(true);
  });

  it("merges when null, undefined and {} are mixed", () => {
    const a = makeRoot("a", 0, 4, { properties: null });
    const b = makeChild("b", "a", 5, 9, { properties: undefined });
    const c = makeChild("c", "a", 10, 14, { properties: {} });
    expect(planMerge([a, b, c]).ok).toBe(true);
  });

  it("merges multi-select arrays with same values in different order", () => {
    const a = makeRoot("a", 0, 4, { properties: { tags: ["x", "y"] } });
    const b = makeChild("b", "a", 5, 9, { properties: { tags: ["y", "x"] } });
    expect(planMerge([a, b]).ok).toBe(true);
  });

  it("does not merge multi-select arrays with different values", () => {
    const a = makeRoot("a", 0, 4, { properties: { tags: ["x"] } });
    const b = makeChild("b", "a", 5, 9, { properties: { tags: ["z"] } });
    expect(planMerge([a, b]).ok).toBe(false);
  });
});

describe("planMerge — groups & survivor", () => {
  it("treats a root piece (id as group key) plus group_id pieces as one group", () => {
    const root = makeRoot("g1", 0, 4);
    const b = makeChild("b", "g1", 5, 9);
    const plan = planMerge([root, b]);
    expect(plan.ok).toBe(true);
  });

  it("fails rule 2 for a single pasted annotation", () => {
    const pasted = makeChild("p", "g1", 0, 4);
    expect(planMerge([pasted])).toEqual({
      ok: false,
      reason: "Select at least two annotations to merge.",
    });
  });

  it("survivor is the root when selected, even when later in time", () => {
    const a = makeChild("a", "g1", 0, 4);
    const root = makeRoot("g1", 5, 9);
    const plan = planMerge([a, root]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.survivor).toBe(root);
    expect(plan.absorbed).toEqual([a]);
  });

  it("without the root, the lowest-start piece survives regardless of input order", () => {
    const b = makeChild("b", "g1", 5, 9);
    const a = makeChild("a", "g1", 0, 4);
    const plan = planMerge([b, a]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.survivor).toBe(a);
    expect(plan.absorbed).toEqual([b]);
  });

  it("merged start/end span all pieces whichever piece survives", () => {
    const a = makeChild("a", "g1", 0, 4);
    const b = makeChild("b", "g1", 5, 9);
    const c = makeChild("c", "g1", 10, 14);
    const plan = planMerge([b, a, c]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.merged.shape_args.start).toBe(0);
    expect(plan.merged.shape_args.end).toBe(14);
    expect(plan.merged.shape_args.frames.map((f: any) => f.frame)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it("keeps both seam keyframes (one per frame number)", () => {
    // Left piece has seam at its end; right piece has seam at its start.
    const a = makeRoot("a", 0, 4, {
      shape_args: {
        start: 0,
        end: 4,
        frames: [
          {
            frame: 0,
            angle: 0,
            points: [
              [0, 0],
              [1, 1],
            ],
          },
          {
            frame: 4,
            angle: 1,
            points: [
              [2, 2],
              [3, 3],
            ],
          },
        ],
      },
    });
    const b = makeChild("b", "a", 5, 9, {
      shape_args: {
        start: 5,
        end: 9,
        frames: [
          {
            frame: 5,
            angle: 1,
            points: [
              [2, 2],
              [3, 3],
            ],
          },
          {
            frame: 9,
            angle: 0,
            points: [
              [0, 0],
              [1, 1],
            ],
          },
        ],
      },
    });
    const plan = planMerge([a, b]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const frames = plan.merged.shape_args.frames;
    expect(frames.map((f: any) => f.frame)).toEqual([0, 4, 5, 9]);
    // Both seam keyframes present (frame 4 and frame 5)
    expect(frames.filter((f: any) => f.frame === 4).length).toBe(1);
    expect(frames.filter((f: any) => f.frame === 5).length).toBe(1);
  });

  it("keeps the group key in a partial merge (B + C of A·B·C·D)", () => {
    const a = makeChild("a", "g1", 0, 4);
    const b = makeChild("b", "g1", 5, 9);
    const c = makeChild("c", "g1", 10, 14);
    const d = makeChild("d", "g1", 15, 19);
    const plan = planMerge([b, c]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.merged.metadata.group_id).toBe("g1");
    expect(plan.range).toEqual([5, 14]);
  });
});

describe("planMerge — integrity", () => {
  it("returns the integrity reason when a keyframe lies outside its own range", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9, {
      shape_args: {
        start: 5,
        end: 9,
        frames: [
          {
            frame: 5,
            angle: 0,
            points: [
              [0, 0],
              [1, 1],
            ],
          },
          {
            frame: 12,
            angle: 0,
            points: [
              [0, 0],
              [1, 1],
            ],
          }, // outside [5,9]
        ],
      },
    });
    const plan = planMerge([a, b]);
    expect(plan).toEqual({
      ok: false,
      reason: "These annotations could not be merged because their keyframe data is inconsistent.",
    });
  });
});

describe("canMerge", () => {
  it("returns true when planMerge succeeds and false otherwise", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    expect(canMerge([a, b])).toBe(true);
    expect(canMerge([a])).toBe(false);
  });
});
