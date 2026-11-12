import { describe, it, expect, beforeEach } from "vitest";
import { recentCategory } from "./recent-category";

describe("recentCategory", () => {
  beforeEach(() => recentCategory.reset());

  it("has nothing before an annotation is created", () => {
    expect(recentCategory.get()).toBeUndefined();
  });

  it("returns the category recorded last", () => {
    recentCategory.record("person", "polygon");
    recentCategory.record("vehicle/car", "box");
    expect(recentCategory.get()).toEqual({ category: "vehicle/car", shapeType: "box" });
  });

  it("ignores an empty category", () => {
    recentCategory.record("vehicle/car", "box");
    recentCategory.record("", "box");
    expect(recentCategory.get()?.category).toBe("vehicle/car");
  });

  it("returns a copy, so callers can't change what is stored", () => {
    recentCategory.record("vehicle/car", "box");
    recentCategory.get()!.category = "changed";
    expect(recentCategory.get()?.category).toBe("vehicle/car");
  });
});
