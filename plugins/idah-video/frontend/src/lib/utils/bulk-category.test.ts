import { describe, expect, it } from "vitest";

import { categoryCounts, prepareBulkCategory, prepareBulkProperties, propertyState, sharedProperties } from "./bulk-category";
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

  it("shows Mixed for different values, including multi-select arrays", () => {
    const items = [
      record("a", "vehicle", { occluded: "No", tags: ["red", "blue"] }),
      record("b", "vehicle", { occluded: "Yes", tags: ["blue", "red"] }),
    ];
    expect(propertyState(items, "occluded")).toEqual({ mixed: true, value: undefined });
    expect(propertyState(items, "tags")).toEqual({ mixed: false, value: ["red", "blue"] });
  });

  it("offers only properties visible for every selected annotation", () => {
    const items = [record("a", "vehicle", {}), record("b", "pedestrian", {})];
    expect(sharedProperties(items, driver).map((field) => field.id)).toEqual(["occluded"]);
  });

  it("changes one property without copying other values", () => {
    const result = prepareBulkProperties([
      record("a", "vehicle", { occluded: "No", condition: "Good" }),
      record("b", "vehicle", { occluded: "Yes", condition: "Damaged" }),
    ], { occluded: "Yes" }, driver, valid);
    expect(result.error).toBeUndefined();
    expect(result.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes", condition: "Good" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes", condition: "Damaged" } },
    ]);
  });

  it("accepts false and zero as explicit property changes", () => {
    const specialDriver = {
      ...driver,
      getFilteredConfig: () => ({ values: [], properties: [
        { ...property("enabled"), type: "boolean" },
        { ...property("score"), type: "integer" },
      ] }),
    } as IIdahDriverV2;
    const result = prepareBulkProperties([
      record("a", "vehicle", { enabled: true, score: 1 }),
      record("b", "vehicle", { enabled: true, score: 2 }),
    ], { enabled: false, score: 0 }, specialDriver, valid);
    expect(result.error).toBeUndefined();
    expect(result.updates.map((update) => update.properties)).toEqual([
      { enabled: false, score: 0 }, { enabled: false, score: 0 },
    ]);
  });

  it("rejects a field hidden for any target before queuing updates", () => {
    const result = prepareBulkProperties([
      record("a", "vehicle", { condition: "Good" }),
      record("b", "pedestrian", { crossing: "Yes" }),
    ], { condition: "Damaged" }, driver, valid);
    expect(result.error).toMatch(/not available/);
    expect(result.updates).toEqual([]);
  });

  it("distinguishes clearing a value from setting an empty multi-select", () => {
    const listDriver = {
      ...driver,
      getFilteredConfig: () => ({ values: [], properties: [
        { ...property("tags"), type: "multi-select" }, property("note"),
      ] }),
    } as IIdahDriverV2;
    const items = [record("a", "vehicle", { tags: ["red"], note: "A" }),
      record("b", "vehicle", { tags: ["blue"], note: "B" })];
    const result = prepareBulkProperties(items, { tags: [], note: undefined }, listDriver, valid);
    expect(result.error).toBeUndefined();
    expect(result.updates.map((update) => update.properties)).toEqual([{ tags: [] }, { tags: [] }]);
  });

  it("removes values hidden after a property edit", () => {
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [], properties: value.properties.mode === "advanced"
          ? [property("mode"), property("detail")]
          : [property("mode")],
      }),
    } as IIdahDriverV2;
    const result = prepareBulkProperties([
      record("a", "vehicle", { mode: "advanced", detail: "A" }),
      record("b", "vehicle", { mode: "advanced", detail: "B" }),
    ], { mode: "basic" }, conditionalDriver, valid);
    expect(result.error).toBeUndefined();
    expect(result.updates.map((update) => update.properties)).toEqual([{ mode: "basic" }, { mode: "basic" }]);
  });
});
