// diff-lines.test.ts — parsePath and diffLines, matching the reference
// HISTORY_DIFF_SPEC.md worked examples.

import { describe, it, expect } from "vitest";
import { parsePath, diffLines, firstFrame, type ChangeEntry } from "./diff-lines";

const text = (changes: ChangeEntry[]) => diffLines(changes).map((l) => `${l.sign}${l.text}`);

describe("parsePath", () => {
  it("round-trips plain and keyed segments", () => {
    expect(parsePath("shape_args").map((s) => s.name)).toEqual(["shape_args"]);
    expect(parsePath("shape_args.frames").map((s) => s.name)).toEqual(["shape_args", "frames"]);
    const keyed = parsePath("shape_args.frames[frame=57].points");
    expect(keyed.map((s) => s.name)).toEqual(["shape_args", "frames", "points"]);
    expect(keyed[1].keyed).toEqual({ key: "frame", value: 57 });
  });

  it("escapes segment separators in hash keys", () => {
    // a.b, c[d, e]f, g\h
    const paths = ["a\\.b", "c\\[d", "e\\]f", "g\\\\h"];
    expect(paths.map((p) => parsePath(p).map((s) => s.name))).toEqual([["a.b"], ["c[d"], ["e]f"], ["g\\h"]]);
  });

  it("keeps dots inside brackets as part of the value", () => {
    const segs = parsePath('shape_args.frames[frame="5.7"].points');
    expect(segs[1].keyed).toEqual({ key: "frame", value: "5.7" });
  });

  it("parses a string key with ] \\ and quotes", () => {
    const segs = parsePath('shape_args.frames[frame="a\\"b\\]c"]');
    expect(segs[1].keyed?.key).toBe("frame");
    expect(segs[1].keyed?.value).toBe('a"b]c');
  });
});

describe("diffLines", () => {
  it("prints parent segments once as context and aligns changed attrs", () => {
    const lines = text([["~", "shape_args.frames[frame=57].points", [1, 2], [3, 4]]]);
    expect(lines).toContain(" shape_args:");
    expect(lines).toContain("   frames:");
    expect(lines).toContain("     - frame: 57");
    expect(lines).toContain("-      points: [1, 2]");
    expect(lines).toContain("+      points: [3, 4]");
  });

  it("prints a removed keyed item with its identity key on the dash line", () => {
    const lines = text([["-", "shape_args.frames[frame=100]", { frame: 100, points: [[0.22, 0.52]], angle: 0 }, null]]);
    expect(lines).toContain(" shape_args:");
    expect(lines).toContain("   frames:");
    expect(lines).toContain("-    - frame: 100");
    expect(lines).toContain("-      points: [[0.22, 0.52]]");
    expect(lines).toContain("-      angle: 0");
  });

  it("renders a full created/baseline payload", () => {
    const lines = text([
      ["+", "shape_type", null, "idah-video:bounding-box"],
      ["+", "shape_args", null, { start: 60, end: 180, frames: [{ frame: 60, points: [[0.07, 0.36]], angle: 0 }] }],
      ["+", "category", null, "cyclist"],
    ]);
    expect(lines).toContain('+shape_type: "idah-video:bounding-box"');
    expect(lines).toContain("+shape_args:");
    expect(lines).toContain("+  start: 60");
    expect(lines).toContain("+  end: 180");
    expect(lines).toContain("+  frames:");
    expect(lines).toContain("+    - frame: 60");
    expect(lines).toContain("+      points: [[0.07, 0.36]]");
    expect(lines).toContain("+      angle: 0");
    expect(lines).toContain('+category: "cyclist"');
  });

  it("renders null on either side", () => {
    const lines = text([["~", "deleted_at", null, "2026-01-01T00:00:00Z"]]);
    expect(lines).toContain("-deleted_at: null");
    expect(lines).toContain('+deleted_at: "2026-01-01T00:00:00Z"');
  });

  it("renders a type change", () => {
    const lines = text([["~", "a", { b: 1 }, [1]]]);
    expect(lines).toContain("-a:");
    expect(lines).toContain("-  b: 1");
    expect(lines).toContain("+a: [1]");
  });

  it("renders a whole-array ~", () => {
    const lines = text([
      [
        "~",
        "shape_args.points",
        [
          [0, 0],
          [1, 1],
        ],
        [
          [0, 0],
          [1, 2],
        ],
      ],
    ]);
    expect(lines).toContain(" shape_args:");
    expect(lines).toContain("-  points: [[0, 0], [1, 1]]");
    expect(lines).toContain("+  points: [[0, 0], [1, 2]]");
  });

  it("caps at 200 lines with a Show N more lines row", () => {
    const changes: ChangeEntry[] = [];
    for (let i = 0; i < 500; i++) {
      changes.push(["+", `shape_args.tile-${i}`, null, { rle: "A" }]);
    }
    const lines = diffLines(changes);
    expect(lines.length).toBe(201);
    expect(lines[200].kind).toBe("more");
    expect(lines[200].text).toContain("more lines");
  });

  it("cuts a single value longer than 2 KB with a Show full value marker", () => {
    const big = "x".repeat(3000);
    const lines = text([["+", "shape_args.rle", null, big]]);
    const line = lines.find((l) => l.startsWith("+"));
    expect(line).toBeDefined();
    expect(line!.length).toBeLessThan(2200);
    expect(line!).toContain("(Show full value)");
  });

  it("aligns array item attributes under the dash content", () => {
    const lines = text([
      [
        "+",
        "shape_args.frames",
        null,
        [
          { frame: 1, points: [[0, 0]] },
          { frame: 2, points: [[1, 1]] },
        ],
      ],
    ]);
    expect(lines).toContain("+  frames:");
    expect(lines).toContain("+    - frame: 1");
    expect(lines).toContain("+      points: [[0, 0]]");
    expect(lines).toContain("+    - frame: 2");
    expect(lines).toContain("+      points: [[1, 1]]");
  });
});

describe("firstFrame", () => {
  it("finds the first frame in a row's paths", () => {
    expect(firstFrame([["~", "shape_args.frames[frame=57].points", [], []]])).toBe(57);
    expect(firstFrame([["~", "category", "a", "b"]])).toBeNull();
  });
});
