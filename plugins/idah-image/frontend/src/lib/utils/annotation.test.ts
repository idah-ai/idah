import { describe, expect, it } from "vitest";

import type { IConfig } from "$idah/v2/types";
import type { IImageAnnotationRecord } from "$lib/types";
import { categoryForShape, countOrphanAnnotations } from "./annotation";

const config: IConfig = {
  rectangle: { values: [{ id: "cat", label: "Cat", color: null, text_color: null }], properties: [] },
  polygon: { values: [{ id: "dog", label: "Dog", color: null, text_color: null }], properties: [] },
};

describe("orphan categories", () => {
  it("does not find a category configured only for another shape", () => {
    expect(categoryForShape(config, "rectangle", "dog")).toBeUndefined();
  });

  it("uses the current shape's label when category IDs overlap", () => {
    const overlapping: IConfig = {
      rectangle: { ...config.rectangle, values: [{ ...config.rectangle.values[0], label: "Rectangle cat" }] },
      polygon: { ...config.polygon, values: [{ ...config.polygon.values[0], id: "cat", label: "Polygon cat" }] },
    };
    expect(categoryForShape(overlapping, "rectangle", "cat")?.label).toBe("Rectangle cat");
  });

  it("counts live annotations whose category is missing from their shape", () => {
    const annotations = [
      { shape_type: "rectangle", category: "cat" },
      { shape_type: "polygon", category: "dog" },
      { shape_type: "rectangle", category: "dog" },
      { shape_type: "rectangle", category: "removed" },
      { shape_type: "rectangle", category: "removed", deleted_at: "2026-01-01" },
      { shape_type: "rectangle", category: undefined },
    ] as IImageAnnotationRecord[];
    expect(countOrphanAnnotations(annotations, config)).toBe(3);
  });
});
