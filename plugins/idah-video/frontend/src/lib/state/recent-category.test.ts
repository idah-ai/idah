import { describe, it, expect, beforeEach } from "vitest";
import { recentCategory } from "./recent-category";

const driver = (datasetId = "ds-1") => ({ dataset: { id: datasetId } }) as any;

describe("recentCategory", () => {
  beforeEach(() => recentCategory.reset());

  it("has nothing before an annotation is created", () => {
    expect(recentCategory.get(driver())).toBeUndefined();
  });

  it("returns the category recorded last", () => {
    recentCategory.record(driver(), "person", "polygon");
    recentCategory.record(driver(), "vehicle/car", "box");
    expect(recentCategory.get(driver())).toEqual({ category: "vehicle/car", shapeType: "box" });
  });

  it("keeps each dataset separate", () => {
    recentCategory.record(driver("ds-1"), "vehicle/car", "box");
    expect(recentCategory.get(driver("ds-2"))).toBeUndefined();
  });

  it("ignores an empty category", () => {
    recentCategory.record(driver(), "vehicle/car", "box");
    recentCategory.record(driver(), "", "box");
    expect(recentCategory.get(driver())?.category).toBe("vehicle/car");
  });

  it("does not touch localStorage", () => {
    expect(() => recentCategory.record(driver(), "vehicle/car", "box")).not.toThrow();
    expect(typeof globalThis.localStorage === "undefined" || globalThis.localStorage.length === 0).toBe(true);
  });
});
