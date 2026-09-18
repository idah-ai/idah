// ---------------------------------------------------------------------------
// text-wrap.spec.ts — Unit tests for SVG label word wrapping
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { clearWrapCache, measureText, tokenize, wrapText, wrapTextWith } from "./text-wrap";

/** Deterministic measurement: one unit per character. */
const byChar = (s: string) => s.length;

describe("tokenize", () => {
  it("keeps the separator attached to the preceding segment", () => {
    expect(tokenize("Vehicle / Commercial / Truck")).toEqual(["Vehicle /", "Commercial /", "Truck"]);
  });

  it("returns a single token for a path with no separator", () => {
    expect(tokenize("Truck")).toEqual(["Truck"]);
  });

  it("returns an empty array for empty text", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("leaves internal spaces within a segment intact", () => {
    expect(tokenize("Heavy Goods / Super Great")).toEqual(["Heavy Goods /", "Super Great"]);
  });
});

describe("wrapTextWith", () => {
  it("keeps everything on one line when it fits", () => {
    expect(wrapTextWith("Vehicle / Truck", 100, byChar)).toEqual(["Vehicle / Truck"]);
  });

  it("breaks at segment boundaries when the line is too long", () => {
    // "Vehicle /" is 9, "Vehicle / Commercial /" is 22 — over the limit of 15.
    expect(wrapTextWith("Vehicle / Commercial / Truck", 15, byChar)).toEqual([
      "Vehicle /",
      "Commercial /",
      "Truck",
    ]);
  });

  it("packs as many segments per line as fit", () => {
    expect(wrapTextWith("Ab / Cd / Ef / Gh", 12, byChar)).toEqual(["Ab / Cd /", "Ef / Gh"]);
  });

  it("returns an empty array for empty text", () => {
    expect(wrapTextWith("", 100, byChar)).toEqual([]);
  });

  // Splitting mid-word would hurt readability more than overflowing does, and
  // retrying a token that can never fit would hang.
  it("emits an over-long single token on its own line rather than looping", () => {
    const long = "Supercalifragilisticexpialidocious";
    expect(wrapTextWith(long, 5, byChar)).toEqual([long]);
  });

  it("does not merge an over-long token with its neighbours", () => {
    expect(wrapTextWith("Ab / Supercalifragilistic / Cd", 6, byChar)).toEqual([
      "Ab /",
      "Supercalifragilistic /",
      "Cd",
    ]);
  });

  it("handles a maxWidth of zero without hanging", () => {
    expect(wrapTextWith("Ab / Cd", 0, byChar)).toEqual(["Ab /", "Cd"]);
  });
});

describe("measureText", () => {
  // vitest runs in node with no DOM, so this exercises the estimate fallback.
  it("estimates a width without a canvas", () => {
    expect(measureText("abcdefghij", "bold 12px sans-serif")).toBeCloseTo(10 * 12 * 0.6, 6);
  });

  it("scales the estimate with the font size", () => {
    const small = measureText("abcdef", "bold 10px sans-serif");
    const large = measureText("abcdef", "bold 20px sans-serif");
    expect(large).toBeCloseTo(small * 2, 6);
  });

  it("falls back to 12px when the font string has no px size", () => {
    expect(measureText("abc", "bold sans-serif")).toBeCloseTo(3 * 12 * 0.6, 6);
  });

  it("returns zero width for empty text", () => {
    expect(measureText("", "bold 12px sans-serif")).toBe(0);
  });
});

describe("wrapText", () => {
  beforeEach(() => clearWrapCache());

  it("wraps using the measured font width", () => {
    // Estimate is 7.2px per char at 12px, so 200px fits ~27 characters.
    const lines = wrapText("Vehicle / Commercial / Truck / White", 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Vehicle / Commercial / Truck / White");
  });

  it("returns the same array instance for a repeated call", () => {
    const a = wrapText("Vehicle / Truck", 200);
    const b = wrapText("Vehicle / Truck", 200);
    expect(b).toBe(a);
  });

  it("caches separately per max width", () => {
    const wide = wrapText("Vehicle / Commercial / Truck", 400);
    const narrow = wrapText("Vehicle / Commercial / Truck", 40);
    expect(narrow).not.toBe(wide);
    expect(narrow.length).toBeGreaterThan(wide.length);
  });

  it("caches separately per font", () => {
    const small = wrapText("Vehicle / Commercial / Truck", 100, "bold 8px sans-serif");
    const large = wrapText("Vehicle / Commercial / Truck", 100, "bold 24px sans-serif");
    expect(large.length).toBeGreaterThan(small.length);
  });

  it("recomputes after the cache is cleared", () => {
    const a = wrapText("Vehicle / Truck", 200);
    clearWrapCache();
    const b = wrapText("Vehicle / Truck", 200);
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
});
