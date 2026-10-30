import { describe, expect, it } from "vitest";

import { bulkFields, bulkPreview, bulkPropertyValidity, categoryCounts, hasMaskCategoryCollision, prepareBulkCategory, prepareBulkProperties, propertyState, sharedCategories, sharedProperties } from "./bulk-category";
import { propertyFullfilled } from "$lib/components/App/SelectionPanel";
import { IMAGE_MASK } from "$lib/types";
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
  it("keeps an explicitly cleared field visible in the bulk draft", () => {
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [],
        properties: value.properties.mode === "hide"
          ? [property("mode")]
          : [property("mode"), property("detail")],
      }),
    } as IIdahDriverV2;
    const items = [record("a", "vehicle", { mode: "show", detail: "A" }),
      record("b", "vehicle", { mode: "show", detail: "B" })];

    expect(bulkFields(items, conditionalDriver, undefined, { mode: "hide" }).map((field) => field.id))
      .toEqual(["mode"]);
    expect(bulkFields(items, conditionalDriver, undefined, { mode: "hide", detail: undefined }).map((field) => field.id))
      .toEqual(["mode", "detail"]);
  });

  it("shows fields for the draft category instead of the mixed original categories", () => {
    const items = [record("a", "vehicle", {}), record("b", "pedestrian", {})];
    expect(bulkFields(items, driver, undefined, {}).map((field) => field.id)).toEqual(["occluded"]);
    expect(bulkFields(items, driver, "vehicle", {}).map((field) => field.id))
      .toEqual(["occluded", "condition"]);
  });

  it("previews category-only, property-only, and combined changes from the same draft rules", () => {
    const items = [record("a", "vehicle", { occluded: "No", condition: "Good" }),
      record("b", "pedestrian", { occluded: "Yes", crossing: "Yes" })];

    expect(bulkPreview(items, driver, undefined, {}, valid)).toBeUndefined();
    expect(bulkPreview(items, driver, "vehicle", {}, valid)?.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "No", condition: "Good" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ]);
    expect(bulkPreview(items, driver, undefined, { occluded: "Yes" }, valid)?.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes", condition: "Good" } },
      { id: "b", category: "pedestrian", properties: { occluded: "Yes", crossing: "Yes" } },
    ]);
    expect(bulkPreview(items, driver, "vehicle", { occluded: "Yes" }, valid)?.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes", condition: "Good" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ]);
  });

  it("treats a draft of the already shared category plus a property as a property edit", () => {
    const items = [record("a", "vehicle", { occluded: "No" }), record("b", "vehicle", { occluded: "Yes" })];
    expect(bulkPreview(items, driver, "vehicle", { occluded: "Yes" }, valid)?.updates).toEqual([
      { id: "a", category: "vehicle", properties: { occluded: "Yes" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ]);
  });

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

  it("keeps mixed required values valid when every target has a valid value", () => {
    const required = { ...property("wheel", true), type: "integer", format: { minimum: 1 } } as IConfigProperty;
    const requiredDriver = {
      ...driver,
      getFilteredConfig: () => ({ values: [], properties: [required] }),
    } as IIdahDriverV2;
    const items = [record("a", "vehicle", { wheel: 4 }), record("b", "vehicle", { wheel: 6 })];

    expect(propertyState(items, "wheel")).toEqual({ mixed: true, value: undefined });
    expect(bulkPropertyValidity(items, required, requiredDriver, undefined, {}, propertyFullfilled)).toBe(true);
  });

  it("marks a required mixed field invalid when one target is missing it", () => {
    const required = { ...property("wheel", true), type: "integer", format: { minimum: 1 } } as IConfigProperty;
    const requiredDriver = {
      ...driver,
      getFilteredConfig: () => ({ values: [], properties: [required] }),
    } as IIdahDriverV2;
    const items = [record("a", "vehicle", { wheel: 4 }), record("b", "vehicle", {})];

    expect(bulkPropertyValidity(items, required, requiredDriver, undefined, {}, propertyFullfilled)).toBe(false);
  });

  it("evaluates dependent visibility from final boolean, numeric, and text values", () => {
    const dependent = property("detail", true);
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [],
        properties: [property("occluded"), property("score"), property("note"),
          ...(value.properties.occluded === true && Number(value.properties.score) > 4 && value.properties.note !== ""
            ? [dependent] : [])],
      }),
    } as IIdahDriverV2;
    const items = [
      record("a", "vehicle", { occluded: true, score: 5, note: "yes", detail: "high" }),
      record("b", "vehicle", { occluded: true, score: 8, note: "yes", detail: "low" }),
    ];

    expect(bulkPropertyValidity(items, dependent, conditionalDriver, undefined, {}, propertyFullfilled)).toBe(true);
    expect(bulkPropertyValidity(items, dependent, conditionalDriver, undefined, { occluded: false }, propertyFullfilled)).toBe(true);
    expect(bulkPreview(items, conditionalDriver, undefined, { occluded: false }, propertyFullfilled)?.updates[0].properties)
      .not.toHaveProperty("detail");
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

  it("rejects property edits across shapes even when a property is shared", () => {
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
    expect(prepareBulkProperties(items, { occluded: "Yes" }, mixedDriver, valid)).toEqual({
      updates: [], error: "Editing is unavailable because the selected annotations have different shapes.",
    });
  });

  it("rejects category and property edits across different shapes", () => {
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
    expect(result).toEqual({
      updates: [], error: "Editing is unavailable because the selected annotations have different shapes.",
    });
  });

  it("rejects a shared category when the shapes differ", () => {
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
    expect(prepareBulkCategory(items, "vehicle", mixedDriver, valid)).toEqual({
      updates: [], error: "Editing is unavailable because the selected annotations have different shapes.",
    });
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
      .toBe("Editing is unavailable because the selected annotations have different shapes.");
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
    expect(result.updates.map((update) => update.properties)).toEqual([
      { mode: "basic" }, { mode: "basic" },
    ]);
  });

  it("removes mixed occlusion levels after applying false", () => {
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [], properties: [
          { ...property("occluded"), type: "boolean" },
          ...(value.properties.occluded === true
            ? [{ ...property("occluded_level"), type: "single-select", format: { options: [
              { id: "50_occluded", label: "50_occluded" },
              { id: "100_occluded", label: "100_occluded" },
            ] } }] : []),
        ],
      }),
    } as IIdahDriverV2;
    const items = [
      record("car", "vehicle", { occluded: true, occluded_level: "100_occluded" }),
      record("bus", "pedestrian", { occluded: true, occluded_level: "50_occluded" }),
    ];

    expect(propertyState(items, "occluded_level").mixed).toBe(true);
    const switchedOff = bulkPreview(items, conditionalDriver, undefined, { occluded: false }, valid)?.updates;
    expect(switchedOff?.map((update) => update.properties))
      .toEqual([{ occluded: false }, { occluded: false }]);
    expect(bulkPreview(items, conditionalDriver, undefined, { occluded: true }, valid)?.error)
      .toBe("No changes to apply.");
    const savedOff = items.map((item, index) => ({ ...item, properties: switchedOff![index].properties }));
    expect(bulkPreview(savedOff, conditionalDriver, undefined, { occluded: true }, valid)?.updates.map((update) => update.properties))
      .toEqual([{ occluded: true }, { occluded: true }]);
    const stale = record("old", "vehicle", { occluded: false, occluded_level: "100_occluded" });
    expect(bulkPreview([stale], conditionalDriver, undefined, { occluded: false }, valid)?.updates[0].properties)
      .toEqual({ occluded: false });
    expect(items.map((item) => item.properties?.occluded_level))
      .toEqual(["100_occluded", "50_occluded"]);
  });

  it("accepts a dependent choice revealed by the same bulk draft", () => {
    const conditionalDriver = {
      ...driver,
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [], properties: [
          { ...property("occluded"), type: "boolean" },
          ...(value.properties.occluded === true
            ? [{ ...property("occluded_level"), type: "single-select", format: { options: [
              { id: "50_occluded", label: "50_occluded" },
              { id: "100_occluded", label: "100_occluded" },
            ] } }] : []),
        ],
      }),
    } as IIdahDriverV2;
    const items = [record("car", "vehicle", {}), record("bus", "pedestrian", {})];
    const draft = { occluded: true, occluded_level: "50_occluded" };

    expect(bulkFields(items, conditionalDriver, undefined, { occluded: true }).map((field) => field.id))
      .toEqual(["occluded", "occluded_level"]);
    expect(bulkPreview(items, conditionalDriver, undefined, draft, valid)).toEqual({ updates: [
      { id: "car", category: "vehicle", properties: draft },
      { id: "bus", category: "pedestrian", properties: draft },
    ] });
  });

  it("detects a mask category used by an unselected mask", () => {
    const entry = [
      { ...record("a", "road", {}), shape_type: IMAGE_MASK },
      { ...record("b", "sidewalk", {}), shape_type: IMAGE_MASK },
      record("c", "sidewalk", {}),
    ];
    expect(hasMaskCategoryCollision([{ id: "a", category: "sidewalk", properties: {} }], entry)).toBe(true);
    expect(hasMaskCategoryCollision([{ id: "a", category: "vehicle", properties: {} }], entry)).toBe(false);
  });

  it("detects a collision between selected masks but ignores non-mask categories", () => {
    const entry = [
      { ...record("a", "road", {}), shape_type: IMAGE_MASK },
      { ...record("b", "sidewalk", {}), shape_type: IMAGE_MASK },
      record("c", "road", {}),
    ];
    expect(hasMaskCategoryCollision([
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ], entry)).toBe(true);
    expect(hasMaskCategoryCollision([{ id: "a", category: "road", properties: {} }], entry)).toBe(false);
  });
});
