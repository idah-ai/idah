import { describe, expect, it } from "vitest";

import { categoryCounts, prepareBulkCategory } from "./bulk-category";
import type { IAnnotationRecord, IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";

const box = "idah-video:bounding-box";
const property = (id: string, required = false): IConfigProperty => ({
  id, label: id, description: "", type: "text", required, visibility: true, format: {},
});
const record = (id: string, category: string, properties: Record<string, unknown>): IAnnotationRecord => ({
  id, shape_type: box, shape_args: {}, category, properties,
});
const driver = {
  config: { [box]: { values: [{ id: "vehicle", label: "Vehicle" }, { id: "pedestrian", label: "Pedestrian" }], properties: [] } },
  getFilteredConfig: (_shape: string, value: Record<string, unknown>) => ({
    values: [],
    properties: value.category === "vehicle"
      ? [property("occluded"), property("condition")]
      : [property("occluded"), property("crossing")],
  }),
} as unknown as IIdahDriverV2;
const valid = (value: unknown, field: IConfigProperty) => !field.required || value !== undefined;

describe("bulk category preparation", () => {
  it("counts every selected annotation by its current category", () => {
    expect(categoryCounts([
      record("a", "vehicle", {}), record("b", "pedestrian", {}), record("c", "vehicle", {}),
    ], driver.config)).toEqual(new Map([
      ["vehicle", { count: 2, label: "Vehicle" }],
      ["pedestrian", { count: 1, label: "Pedestrian" }],
    ]));
  });

  it("uses full category paths from each shape type, including unresolved paths", () => {
    const polygon = "idah-video:polygon";
    const counts = categoryCounts([
      record("a", "vehicle", {}),
      { ...record("b", "people/pedestrian", {}), shape_type: polygon },
      { ...record("c", "people/unknown", {}), shape_type: polygon },
    ], { ...driver.config, [polygon]: { values: [{ id: "people/pedestrian", label: "Person", color: null, text_color: null }], properties: [] } });

    expect(counts).toEqual(new Map([
      ["vehicle", { count: 1, label: "Vehicle" }],
      ["people/pedestrian", { count: 1, label: "People / Person" }],
      ["people/unknown", { count: 1, label: "People / Unknown" }],
    ]));
  });

  it("keeps each target's visible values and removes hidden values", () => {
    const result = prepareBulkCategory([
      record("a", "vehicle", { occluded: "No", condition: "Good" }),
      record("b", "pedestrian", { occluded: "Yes", crossing: "Yes" }),
    ], "vehicle", driver, valid);

    expect(result.error).toBeUndefined();
    expect(result.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "No", condition: "Good" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ]);
  });

  it("rejects a category not available for every target", () => {
    const result = prepareBulkCategory([record("a", "vehicle", {})], "unknown", driver, valid);
    expect(result.error).toMatch(/not available/);
    expect(result.updates).toEqual([]);
  });

  it("rejects a newly visible required property with no value", () => {
    const requiredDriver = {
      ...driver,
      getFilteredConfig: () => ({ values: [], properties: [property("helmet", true)] }),
    } as IIdahDriverV2;
    const result = prepareBulkCategory([record("a", "pedestrian", {})], "vehicle", requiredDriver, valid);
    expect(result.error).toContain("helmet");
    expect(result.updates).toEqual([]);
  });
});
