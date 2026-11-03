import { describe, expect, it } from "vitest";

import type { IConfig } from "$idah/v2/types";
import type { IVideoAnnotationRecord } from "$lib/types";
import { categoryForShape, configuredCategories, countOrphanAnnotations, isOrphanCategory } from "./annotation";

const config: IConfig = {
  rectangle: { values: [{ id: "cat", label: "Cat", color: null, text_color: null }], properties: [] },
  polygon: { values: [{ id: "dog", label: "Dog", color: null, text_color: null }], properties: [] },
};

describe("orphan categories", () => {
  it("finds a category configured for another shape", () => {
    const configured = configuredCategories(config);
    expect(configured.get("dog")?.label).toBe("Dog");
    expect(isOrphanCategory("dog", configured)).toBe(false);
  });

  it("uses the current shape's label when category IDs overlap", () => {
    const overlapping: IConfig = {
      rectangle: { ...config.rectangle, values: [{ ...config.rectangle.values[0], label: "Rectangle cat" }] },
      polygon: { ...config.polygon, values: [{ ...config.polygon.values[0], id: "cat", label: "Polygon cat" }] },
    };
    expect(categoryForShape(overlapping, "rectangle", "cat", configuredCategories(overlapping))?.label).toBe("Rectangle cat");
  });

  it("counts only live annotations with missing categories", () => {
    const annotations = [
      { category: "dog" },
      { category: "removed" },
      { category: "removed", deleted_at: "2026-01-01" },
      { category: undefined },
    ] as IVideoAnnotationRecord[];
    expect(countOrphanAnnotations(annotations, config)).toBe(1);
  });
});
