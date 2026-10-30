// ---------------------------------------------------------------------------
// visibility-fields.test.ts — fields, operators and checks for the visibility builder
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import peggy from "peggy";
import grammar from "@/utils/ast_parser.pegjs?raw";

const parse = (input: string) => peggy.generate(grammar).parse(input);

import type { IConfigProperty, IConfigValue } from "@/plugin/v2/types";
import { newCondition, newGroup, type RuleCondition } from "@/utils/visibility_rules";

import {
  applyField,
  applyOperator,
  builderOperator,
  canEditInBuilder,
  conditionProblem,
  conditionReferenceProblems,
  defaultCondition,
  defaultGroupConditions,
  describeRules,
  fieldFor,
  hasProblems,
  operatorsFor,
  selectableFields,
  usesOptions,
  visibilityFields,
  visibilityReferenceErrors,
} from "./visibility-fields";

const category = (id: string, label: string): IConfigValue => ({ id, label, color: null, text_color: null });
const property = (id: string, label: string, type: IConfigProperty["type"], options?: string[]): IConfigProperty => ({
  id,
  label,
  description: "",
  type,
  required: false,
  visibility: true,
  format: options ? { options: options.map((o) => ({ id: o, label: o[0].toUpperCase() + o.slice(1) })) } : {},
});

const categories = [
  category("vehicles/car", "Car"),
  category("vehicles/heavy/truck", "Truck"),
  category("pedestrian", "Pedestrian"),
];
const properties = [
  property("occluded", "Occluded", "boolean"),
  property("occlusion-level", "Occlusion level", "single-select", ["partial", "heavy"]),
  property("lanes", "Lane count", "integer"),
  property("plate-text", "Plate text", "text"),
  property("colors", "Colors", "multi-select", ["red", "blue"]),
];
const fields = visibilityFields(categories, properties, "plate-text");
const field = (path: string) => fields.find((f) => f.path === path)!;

describe("visibilityFields", () => {
  it("lists category first, then the other properties", () => {
    expect(fields.map((f) => [f.path, f.kind])).toEqual([
      ["category", "category"],
      ["properties.occluded", "boolean"],
      ["properties.occlusion-level", "select"],
      ["properties.lanes", "integer"],
      ["properties.colors", "multi"],
    ]);
  });

  it("labels categories by name, with their parents as a hint, and lists the parents for is under", () => {
    expect(field("category").options).toEqual([
      { value: "vehicles/car", label: "Car", hint: "Vehicles" },
      { value: "vehicles/heavy/truck", label: "Truck", hint: "Vehicles / Heavy" },
      { value: "pedestrian", label: "Pedestrian" },
    ]);
    expect(field("category").parents).toEqual([
      { value: "vehicles", label: "Vehicles" },
      { value: "vehicles/heavy", label: "Heavy", hint: "Vehicles" },
    ]);
  });

  it("keeps the full path for category names used more than once", () => {
    const shared = visibilityFields([category("car/other", "Other"), category("bus/other", "Other")], [], "x");
    expect(shared[0].options.map((o) => o.label)).toEqual(["Car / Other", "Bus / Other"]);
  });

  it("uses select options as the values of a single select", () => {
    expect(field("properties.occlusion-level").options).toEqual([
      { value: "partial", label: "Partial" },
      { value: "heavy", label: "Heavy" },
    ]);
  });

  it("leaves out the category field when the config has no categories", () => {
    expect(visibilityFields([], properties, "x").some((f) => f.path === "category")).toBe(false);
  });

  it("offers multi-select properties with the contains operators only", () => {
    expect(selectableFields(fields).map((f) => f.path)).toContain("properties.colors");
    expect(operatorsFor(field("properties.colors"))).toEqual([
      { value: "has_any", label: "contains any of" },
      { value: "has_all", label: "contains all of" },
      { value: "has_none", label: "contains none of" },
    ]);
  });
});

describe("fieldFor", () => {
  it("finds a field by path", () => {
    expect(fieldFor(fields, newCondition("properties.lanes", "gt", 2))).toBe(field("properties.lanes"));
  });

  it("makes a multi-select placeholder for a missing field used with contains", () => {
    expect(fieldFor(fields, newCondition("properties.gone", "has_any", ["a"]))).toMatchObject({
      kind: "multi",
      options: [{ value: "a", label: "a" }],
    });
  });

  it("makes a placeholder field for a path that no longer exists", () => {
    const missing = fieldFor(fields, newCondition("properties.removed", "eq", "x"));
    expect(missing).toMatchObject({ path: "properties.removed", kind: "text", missing: true });
    expect(fieldFor(fields, newCondition("properties.gone", "eq", true)).kind).toBe("boolean");
    expect(fieldFor(fields, newCondition("properties.gone", "gt", 1)).kind).toBe("integer");
    expect(fieldFor(fields, newCondition("properties.gone", "in", ["a", "b"]))).toMatchObject({
      kind: "select",
      options: [
        { value: "a", label: "a" },
        { value: "b", label: "b" },
      ],
    });
  });
});

describe("operators", () => {
  it("offers is under only when categories have parents", () => {
    expect(operatorsFor(field("category")).map((o) => o.value)).toContain("under");
    const flat = visibilityFields([category("pedestrian", "Pedestrian")], [], "x");
    expect(operatorsFor(flat[0]).map((o) => o.value)).not.toContain("under");
  });

  it("shows category match <parent>/* as is under", () => {
    const cond = newCondition("category", "match", "vehicles/*");
    expect(builderOperator(cond, field("category"))).toBe("under");
    expect(builderOperator(newCondition("category", "match", "veh*"), field("category"))).toBe("match");
  });
});

describe("defaultCondition", () => {
  it("starts on the first field with its first operator", () => {
    expect(defaultCondition(fields)).toMatchObject({ field: "category", operator: "eq", value: "vehicles/car" });
  });

  it("is undefined when there is nothing to compare", () => {
    expect(defaultCondition(visibilityFields([], [], "x"))).toBeUndefined();
  });
});

describe("defaultGroupConditions", () => {
  it("starts on the first two values of the first field", () => {
    expect(defaultGroupConditions(fields)).toMatchObject([
      { field: "category", operator: "eq", value: "vehicles/car" },
      { field: "category", operator: "eq", value: "vehicles/heavy/truck" },
    ]);
  });

  it("starts with one condition when the field has no second value", () => {
    const oneCategory = visibilityFields([category("pedestrian", "Pedestrian")], [], "x");
    expect(defaultGroupConditions(oneCategory)).toMatchObject([{ field: "category", value: "pedestrian" }]);

    const booleanOnly = visibilityFields([], [property("occluded", "Occluded", "boolean")], "x");
    expect(defaultGroupConditions(booleanOnly)).toMatchObject([{ field: "properties.occluded", value: true }]);
  });

  it("is empty when there is nothing to compare", () => {
    expect(defaultGroupConditions(visibilityFields([], [], "x"))).toEqual([]);
  });
});

describe("applyField / applyOperator", () => {
  const cond = newCondition("category", "eq", "pedestrian");

  it("resets the operator and value when the field changes", () => {
    expect(applyField(cond, field("properties.occluded"))).toMatchObject({
      id: cond.id,
      field: "properties.occluded",
      operator: "eq",
      value: true,
    });
    expect(applyField(cond, field("properties.lanes"))).toMatchObject({ operator: "eq", value: 0 });
    expect(applyField(cond, field("properties.occlusion-level"))).toMatchObject({ operator: "eq", value: "partial" });
  });

  it("stores is under as match <parent>/*", () => {
    expect(applyOperator(cond, "under", field("category"))).toMatchObject({ operator: "match", value: "vehicles/*" });
  });

  it("keeps the chosen value when switching to and from is one of", () => {
    const list = applyOperator(cond, "in", field("category"));
    expect(list).toMatchObject({ operator: "in", value: ["pedestrian"] });
    expect(applyOperator({ ...list, value: ["vehicles/car", "pedestrian"] }, "neq", field("category"))).toMatchObject({
      operator: "neq",
      value: "vehicles/car",
    });
  });

  it("starts a multi-select on contains any of, and keeps the list between contains operators", () => {
    const cond = newCondition("category", "eq", "pedestrian");
    const colors = applyField(cond, field("properties.colors"));
    expect(colors).toMatchObject({ field: "properties.colors", operator: "has_any", value: [] });
    expect(applyOperator({ ...colors, value: ["red"] }, "has_none", field("properties.colors"))).toMatchObject({
      operator: "has_none",
      value: ["red"],
    });
  });

  it("keeps the value between operators of the same kind", () => {
    const lanes = newCondition("properties.lanes", "gt", 3);
    expect(applyOperator(lanes, "lte", field("properties.lanes"))).toMatchObject({ operator: "lte", value: 3 });
  });
});

describe("conditionProblem", () => {
  const problem = (cond: RuleCondition) => conditionProblem(cond, fieldFor(fields, cond));

  it("accepts complete conditions", () => {
    expect(problem(newCondition("category", "in", ["pedestrian"]))).toBeUndefined();
    expect(problem(newCondition("properties.lanes", "gt", 2))).toBeUndefined();
    expect(problem(newCondition("properties.occluded", "eq", false))).toBeUndefined();
  });

  it("reports an empty list, an empty value, a double quote and a non-whole number", () => {
    expect(problem(newCondition("category", "in", []))).toBe("Choose at least one option");
    expect(problem(newCondition("properties.removed", "eq", ""))).toBe("Enter a value");
    expect(problem(newCondition("properties.removed", "eq", 'say "hi"'))).toBe("Values can't contain double quotes");
    expect(problem(newCondition("properties.lanes", "gt", 1.5))).toBe("Enter a whole number");
    expect(problem(newCondition("properties.lanes", "gt", Number.NaN))).toBe("Enter a whole number");
    expect(problem(newCondition("properties.lanes", "gt", 1e21))).toBe("Enter a whole number");
  });

  it("accepts negative whole numbers", () => {
    expect(problem(newCondition("properties.lanes", "gt", -5))).toBeUndefined();
  });

  it("asks for a pattern on an empty category match", () => {
    expect(problem(newCondition("category", "match", ""))).toBe("Enter a value");
    expect(problem(newCondition("category", "eq", ""))).toBe("Choose a value");
  });

  it("finds a problem anywhere in a group", () => {
    const ok = newGroup("all", [newCondition("category", "eq", "pedestrian")]);
    const bad = newGroup("all", [ok, newGroup("any", [newCondition("category", "in", [])])]);
    expect(hasProblems(ok, fields)).toBe(false);
    expect(hasProblems(bad, fields)).toBe(true);
  });
});

describe("conditionReferenceProblems", () => {
  it("marks a missing field selector", () => {
    expect(
      conditionReferenceProblems(
        newCondition("properties.removed", "eq", "x"),
        fieldFor(fields, newCondition("properties.removed", "eq", "x")),
      ),
    ).toEqual({
      field: 'Field "properties.removed" no longer exists.',
    });
  });

  it("marks a missing category value selector", () => {
    expect(conditionReferenceProblems(newCondition("category", "eq", "vehicles/van"), field("category"))).toEqual({
      value: 'Value "vehicles/van" no longer exists.',
    });
  });

  it("marks a missing parent category selector", () => {
    expect(conditionReferenceProblems(newCondition("category", "match", "missing/*"), field("category"))).toEqual({
      value: 'Value "missing/*" no longer exists.',
    });
  });

  it("accepts typed category patterns", () => {
    expect(conditionReferenceProblems(newCondition("category", "match", "veh*"), field("category"))).toEqual({});
  });
});

describe("canEditInBuilder", () => {
  it("accepts conditions that fit their field", () => {
    const group = newGroup("all", [
      newCondition("category", "match", "vehicles/*"),
      newCondition("properties.occluded", "eq", true),
      newCondition("properties.occlusion-level", "in", ["heavy"]),
      newCondition("properties.removed", "eq", "x"),
    ]);
    expect(canEditInBuilder(group, fields)).toBe(true);
  });

  it("accepts contains conditions on a multi-select", () => {
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.colors", "has_all", ["red"])]), fields)).toBe(
      true,
    );
  });

  it("rejects other operators on a multi-select, and values of the wrong type", () => {
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.colors", "eq", "red")]), fields)).toBe(false);
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.colors", "has_any", "red")]), fields)).toBe(
      false,
    );
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.lanes", "eq", "two")]), fields)).toBe(false);
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.lanes", "in", [1, 2])]), fields)).toBe(false);
    expect(canEditInBuilder(newGroup("all", [newCondition("properties.occluded", "gt", true)]), fields)).toBe(false);
  });
});

describe("usesOptions", () => {
  it("picks category and select values from the options, except a category pattern", () => {
    expect(usesOptions(field("category"), "eq")).toBe(true);
    expect(usesOptions(field("category"), "match")).toBe(false);
    expect(usesOptions(field("properties.occlusion-level"), "eq")).toBe(true);
    expect(usesOptions(field("properties.lanes"), "eq")).toBe(false);
  });
});

describe("describeRules", () => {
  it("reads like a sentence, with nested groups in parentheses", () => {
    const group = newGroup("all", [
      newCondition("properties.occluded", "eq", true),
      newGroup("any", [
        newCondition("category", "match", "vehicles/*"),
        newCondition("category", "in", ["pedestrian"]),
      ]),
      newCondition("properties.lanes", "gte", 2),
    ]);
    expect(describeRules(group, fields)).toBe(
      "Occluded is yes and (Category is under Vehicles or Category is one of Pedestrian) and Lane count ≥ 2",
    );
  });

  it("describes contains conditions", () => {
    const group = newGroup("all", [newCondition("properties.colors", "has_any", ["red", "blue"])]);
    expect(describeRules(group, fields)).toBe("Colors contains any of Red, Blue");
  });

  it("marks values and fields that no longer exist", () => {
    const group = newGroup("all", [
      newCondition("category", "eq", "vehicles/van"),
      newCondition("properties.removed", "eq", "x"),
    ]);
    expect(describeRules(group, fields)).toBe(
      'Category is vehicles/van (not found) and properties.removed (not found) is "x"',
    );
  });

  it("shows a category match pattern as typed", () => {
    const group = newGroup("all", [newCondition("category", "match", "veh*")]);
    expect(describeRules(group, fields)).toBe('Category matches "veh*"');
  });

  it("is empty for an empty group", () => {
    expect(describeRules(newGroup("all", []), fields)).toBe("");
  });
});

describe("visibilityReferenceErrors", () => {
  it("accepts existing property and category references", () => {
    expect(
      visibilityReferenceErrors(
        parse('category = "vehicles/car" and properties.occluded = true'),
        categories,
        properties,
      ),
    ).toEqual([]);
  });

  it("reports missing property references", () => {
    expect(visibilityReferenceErrors(parse("properties.deleted = true"), categories, properties)).toEqual([
      {
        reference: "properties.deleted",
        message: 'Visibility references missing property "deleted".',
      },
    ]);
  });

  it("reports missing category references in nested expressions and lists", () => {
    const errors = visibilityReferenceErrors(
      parse('(category in ["vehicles/car", "vehicle/truck"]) or (category = "missing")'),
      categories,
      properties,
    );

    expect(errors).toEqual([
      {
        reference: "category:vehicle/truck",
        message: 'Visibility references missing category "vehicle/truck".',
      },
      {
        reference: "category:missing",
        message: 'Visibility references missing category "missing".',
      },
    ]);
  });

  it("accepts category patterns and existing category paths", () => {
    expect(
      visibilityReferenceErrors(parse('category match "veh*" and category match "vehicles/*"'), categories, properties),
    ).toEqual([]);
  });

  it("reports a missing category path for an under rule", () => {
    expect(visibilityReferenceErrors(parse('category match "missing/*"'), categories, properties)).toEqual([
      {
        reference: "category:missing/*",
        message: 'Visibility references missing category path "missing".',
      },
    ]);
  });
});
