import { describe, expect, it } from "vitest";
import { categoryShare, categoryTotal, sortCategories } from "./category-totals";

const row = (id: string, count: number, label = id) => ({
  id,
  category: id,
  label,
  configured: true,
  annotation_count: count,
});

describe("category totals", () => {
  it("counts annotations rather than entries, including zero and unconfigured categories", () => {
    expect(categoryTotal([row("car", 3), row("person", 0), { ...row("removed", 2), configured: false }])).toBe(5);
    expect(categoryTotal([])).toBe(0);
  });

  it("rejects negative, fractional, duplicate and unsafe counts", () => {
    for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => categoryTotal([row("car", value)])).toThrow();
    expect(() => categoryTotal([row("car", 1), row("car", 2)])).toThrow();
    expect(() => categoryTotal([row("car", Number.MAX_SAFE_INTEGER), row("person", 1)])).toThrow();
  });

  it("keeps small positive shares visible and handles an empty denominator", () => {
    expect(categoryShare(1, 1000)).toEqual({ value: 0.1, label: "<1%" });
    expect(categoryShare(1, 4)).toEqual({ value: 25, label: "25%" });
    expect(categoryShare(0, 0)).toEqual({ value: 0, label: "0%" });
  });

  it("sorts by count then label without combining conflicting labels or mutating the input", () => {
    const rows = [row("car", 3, "Vehicle"), row("automobile", 3, "Car"), row("person", 10)];
    expect(sortCategories(rows).map((item) => item.label)).toEqual(["person", "Car", "Vehicle"]);
    expect(rows[0].label).toBe("Vehicle");
  });
});
