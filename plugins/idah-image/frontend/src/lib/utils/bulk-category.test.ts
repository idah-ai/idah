import { describe, expect, it } from "vitest";

import { categoryCounts, prepareBulkCategory, prepareBulkProperties, propertyState, sharedCategories, sharedProperties } from "./bulk-category";
import { propertyFullfilled } from "$lib/components/App/SelectionPanel";
import type { IAnnotationRecord, IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";

const box = "idah-image:bounding-box";
const otherShape = "idah-image:polygon";
const category = (id: string) => ({ id, label: id, color: null, text_color: null });
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
    const circle = "idah-image:circle";
    const counts = categoryCounts([
      record("a", "vehicle", {}),
      { ...record("b", "people/pedestrian", {}), shape_type: circle },
      { ...record("c", "people/unknown", {}), shape_type: circle },
    ], { ...driver.config, [circle]: { values: [{ id: "people/pedestrian", label: "Person", color: null, text_color: null }], properties: [] } });

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

  it("offers only category IDs available to both shape types", () => {
    const config = {
      [box]: { values: [category("vehicle"), category("pedestrian")], properties: [] },
      [otherShape]: { values: [category("vehicle"), category("cyclist")], properties: [] },
    };
    const items = [record("a", "vehicle", {}),
      { ...record("b", "cyclist", {}), shape_type: otherShape }];
    expect(sharedCategories(items, config).map((value) => value.id)).toEqual(["vehicle"]);
  });

  it("applies a shared property across shapes and preserves their other values", () => {
    const mixedDriver = {
      ...driver,
      config: {
        [box]: { values: [category("vehicle")], properties: [] },
        [otherShape]: { values: [category("pedestrian")], properties: [] },
      },
      getFilteredConfig: (shape: string) => ({
        values: [], properties: shape === box
          ? [property("occluded"), property("condition")]
          : [property("occluded")],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { occluded: "No", condition: "Good" }),
      { ...record("b", "pedestrian", { occluded: "No" }), shape_type: otherShape },
    ];
    expect(sharedCategories(items, mixedDriver.config)).toEqual([]);
    expect(sharedProperties(items, mixedDriver).map((field) => field.id)).toEqual(["occluded"]);
    expect(prepareBulkProperties(items, { occluded: "Yes" }, mixedDriver, valid).updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes", condition: "Good" } },
      { id: "b", category: "pedestrian", properties: { occluded: "Yes" } },
    ]);
  });

  it("applies a shared category and property across different shapes", () => {
    const mixedDriver = {
      ...driver,
      config: {
        [box]: { values: [category("vehicle"), category("pedestrian")], properties: [] },
        [otherShape]: { values: [category("vehicle"), category("pedestrian")], properties: [] },
      },
      getFilteredConfig: (shape: string, value: { category: string }) => ({
        values: [], properties: shape === box
          ? [property("occluded"), property("condition")]
          : value.category === "vehicle"
            ? [property("occluded")]
            : [property("occluded"), property("crossing")],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { occluded: "No", condition: "Good" }),
      { ...record("b", "pedestrian", { occluded: "No", crossing: "Yes" }), shape_type: otherShape },
    ];
    expect(sharedProperties(items, mixedDriver).map((field) => field.id)).toEqual(["occluded"]);
    const result = prepareBulkCategory(items, "vehicle", mixedDriver, valid, { occluded: "Yes" });
    expect(result.error).toBeUndefined();
    expect(result.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes", condition: "Good" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ]);
  });

  it("allows a shared category when the shapes share no property", () => {
    const mixedDriver = {
      ...driver,
      config: {
        [box]: { values: [category("vehicle"), category("pedestrian")], properties: [] },
        [otherShape]: { values: [category("vehicle"), category("pedestrian")], properties: [] },
      },
      getFilteredConfig: (shape: string) => ({
        values: [], properties: shape === box ? [property("condition")] : [property("crossing")],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { condition: "Good" }),
      { ...record("b", "pedestrian", { crossing: "Yes" }), shape_type: otherShape },
    ];
    expect(sharedProperties(items, mixedDriver)).toEqual([]);
    expect(sharedCategories(items, mixedDriver.config).map((value) => value.id))
      .toEqual(["vehicle", "pedestrian"]);
    expect(prepareBulkCategory(items, "vehicle", mixedDriver, valid).updates).toEqual([
      { id: "a", category: "vehicle", properties: { condition: "Good" } },
      { id: "b", category: "vehicle", properties: { crossing: "Yes" } },
    ]);
  });

  it("finds no choices when mixed shapes have no shared configuration", () => {
    const mixedDriver = {
      ...driver,
      config: {
        [box]: { values: [category("vehicle")], properties: [] },
        [otherShape]: { values: [category("road")], properties: [] },
      },
      getFilteredConfig: (shape: string) => ({
        values: [], properties: shape === box ? [property("occluded")] : [property("surface")],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { occluded: "No" }),
      { ...record("b", "road", { surface: "Asphalt" }), shape_type: otherShape },
    ];
    expect(sharedCategories(items, mixedDriver.config)).toEqual([]);
    expect(sharedProperties(items, mixedDriver)).toEqual([]);
  });

  it("excludes same-ID fields with different types or option sets", () => {
    const choice = (options: string[]) => ({
      ...property("occluded"), type: "single-select",
      format: { options: options.map((id) => ({ id, label: id })) },
    }) as IConfigProperty;
    const first = choice(["yes", "no"]);
    const differentOptions = choice(["yes"]);
    const mixedDriver = {
      ...driver,
      config: {
        [box]: { values: [category("vehicle")], properties: [] },
        [otherShape]: { values: [category("vehicle")], properties: [] },
      },
      getFilteredConfig: (shape: string) => ({
        values: [], properties: [shape === box ? first : differentOptions],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { occluded: "no" }),
      { ...record("b", "vehicle", { occluded: "yes" }), shape_type: otherShape },
    ];
    expect(sharedProperties(items, mixedDriver)).toEqual([]);
    expect(prepareBulkCategory(items, "vehicle", mixedDriver, valid, { occluded: "yes" }).error)
      .toMatch(/not available|shared/);
    const differentTypeDriver = {
      ...mixedDriver,
      getFilteredConfig: (shape: string) => ({
        values: [], properties: [shape === box ? first : { ...first, type: "boolean", format: {} }],
      }),
    } as IIdahDriverV2;
    expect(sharedProperties(items, differentTypeDriver)).toEqual([]);
  });

  it("offers fields exposed by the draft category", () => {
    const items = [record("a", "vehicle", { condition: "Good" }),
      record("b", "pedestrian", { crossing: "Yes" })];
    expect(sharedProperties(items, driver, "vehicle").map((field) => field.id))
      .toEqual(["occluded", "condition"]);
  });

  it("rechecks conditional fields after pruning old-category values", () => {
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { category: string; properties: Record<string, unknown> }) => ({
        values: [], properties: value.category === "vehicle"
          ? value.properties.crossing === undefined
            ? [property("condition")]
            : []
          : [property("crossing")],
      }),
    } as IIdahDriverV2;
    const items = [record("a", "pedestrian", { crossing: "Yes" }),
      record("b", "pedestrian", { crossing: "No" })];
    expect(sharedProperties(items, conditionalDriver, "vehicle").map((field) => field.id))
      .toEqual(["condition"]);
  });

  it("applies category and chosen properties together while preserving other visible values", () => {
    const result = prepareBulkCategory([
      record("a", "vehicle", { occluded: "No", condition: "Good" }),
      record("b", "pedestrian", { occluded: "Yes", crossing: "Yes" }),
    ], "vehicle", driver, valid, { condition: "Damaged" });

    expect(result.error).toBeUndefined();
    expect(result.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "No", condition: "Damaged" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes", condition: "Damaged" } },
    ]);
  });

  it("rejects a chosen property hidden by the resulting category", () => {
    const result = prepareBulkCategory([
      record("a", "vehicle", { condition: "Good" }),
      record("b", "pedestrian", { crossing: "Yes" }),
    ], "pedestrian", driver, valid, { condition: "Damaged" });

    expect(result.error).toMatch(/hidden|available/);
    expect(result.updates).toEqual([]);
  });

  it("accepts a newly required property supplied with the category change", () => {
    const requiredDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { category: string }) => ({
        values: [], properties: value.category === "vehicle" ? [property("helmet", true)] : [],
      }),
    } as IIdahDriverV2;
    const items = [record("a", "pedestrian", {}), record("b", "pedestrian", {})];
    expect(prepareBulkCategory(items, "vehicle", requiredDriver, valid).error).toContain("helmet");
    expect(prepareBulkCategory(items, "vehicle", requiredDriver, valid, { helmet: "Yes" }).error)
      .toBeUndefined();
  });

  it("blocks every target until a newly visible required choice is valid", () => {
    const helmet = {
      ...property("helmet", true),
      label: "Helmet",
      type: "single-select",
      format: { options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
    } as IConfigProperty;
    const cyclistDriver = {
      ...driver,
      config: { [box]: { values: [
        { id: "vehicle", label: "Vehicle", color: null, text_color: null },
        { id: "cyclist", label: "Cyclist", color: null, text_color: null },
      ], properties: [] } },
      getFilteredConfig: (_shape: string, value: { category: string }) => ({
        values: [], properties: value.category === "cyclist" ? [helmet] : [],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { helmet: "yes" }),
      record("b", "vehicle", {}),
    ];

    const missing = prepareBulkCategory(items, "cyclist", cyclistDriver, propertyFullfilled);
    expect(missing).toEqual({ updates: [], error: "Helmet needs a valid value." });
    const invalid = prepareBulkCategory(items, "cyclist", cyclistDriver, propertyFullfilled, { helmet: "unknown" });
    expect(invalid.updates).toEqual([]);
    expect(invalid.error).toContain("Helmet");
    const valid = prepareBulkCategory(items, "cyclist", cyclistDriver, propertyFullfilled, { helmet: "no" });
    expect(valid.error).toBeUndefined();
    expect(valid.updates).toEqual([
      { id: "a", category: "cyclist", properties: { helmet: "no" } },
      { id: "b", category: "cyclist", properties: { helmet: "no" } },
    ]);
  });

  it("accepts false and zero for newly required fields", () => {
    const requiredDriver = {
      ...driver,
      getFilteredConfig: () => ({
        values: [], properties: [
          { ...property("helmet", true), type: "boolean" },
          { ...property("score", true), type: "integer", format: { minimum: 0 } },
        ],
      }),
    } as IIdahDriverV2;
    const items = [record("a", "pedestrian", {}), record("b", "pedestrian", {})];
    const result = prepareBulkCategory(items, "vehicle", requiredDriver, propertyFullfilled, {
      helmet: false, score: 0,
    });
    expect(result.error).toBeUndefined();
    expect(result.updates.map((update) => update.properties)).toEqual([
      { helmet: false, score: 0 }, { helmet: false, score: 0 },
    ]);
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
