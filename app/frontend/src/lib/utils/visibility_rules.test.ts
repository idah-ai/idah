// ---------------------------------------------------------------------------
// visibility_rules.test.ts — visibility AST <-> builder rules, and AST printing
// ---------------------------------------------------------------------------

import peggy from "peggy";
import { describe, expect, it } from "vitest";

import type { ASTNode } from "@/plugin/v2/types";

import grammar from "./ast_parser.pegjs?raw";
import {
  isRuleGroup,
  newCondition,
  newGroup,
  rulesFromAst,
  rulesToAst,
  visibilityToText,
  type RuleGroup,
  type RuleItem,
  type Visibility,
} from "./visibility_rules";

const parser = peggy.generate(grammar);
const parse = (input: string): ASTNode => parser.parse(input);

/** Rules without their generated ids, so tests can compare structure. */
type Shape = { mode: string; items: Shape[] } | { field: string; operator: string; value: unknown };
function shape(item: RuleItem): Shape {
  if (isRuleGroup(item)) return { mode: item.mode, items: item.items.map(shape) };
  return { field: item.field, operator: item.operator, value: item.value };
}
const rules = (input: string | Visibility) => {
  const group = rulesFromAst(typeof input === "string" ? parse(input) : input);
  return group && shape(group);
};

const c = (field: string, operator: string, value: unknown) => ({ field, operator, value });
const all = (...items: Shape[]) => ({ mode: "all", items });
const any = (...items: Shape[]) => ({ mode: "any", items });

describe("rulesFromAst", () => {
  it("reads true (no condition) as an empty group", () => {
    expect(rules(true)).toEqual(all());
  });

  it("can't show false (always hidden)", () => {
    expect(rules(false)).toBeNull();
  });

  it("wraps a single comparison in a group", () => {
    expect(rules('category = "traffic-light"')).toEqual(all(c("category", "eq", "traffic-light")));
  });

  it("reads every comparison operator", () => {
    expect(rules("properties.lanes != 1 or properties.lanes < 2 or properties.lanes > 3")).toEqual(
      any(c("properties.lanes", "neq", 1), c("properties.lanes", "lt", 2), c("properties.lanes", "gt", 3)),
    );
    expect(rules("properties.lanes <= 1 or properties.lanes >= 2")).toEqual(
      any(c("properties.lanes", "lte", 1), c("properties.lanes", "gte", 2)),
    );
    expect(rules('category match "vehicles/*"')).toEqual(all(c("category", "match", "vehicles/*")));
  });

  it("reads lists and booleans", () => {
    expect(rules('category in ["pedestrian", "cyclist"]')).toEqual(all(c("category", "in", ["pedestrian", "cyclist"])));
    expect(rules("properties.lanes in [1, 2]")).toEqual(all(c("properties.lanes", "in", [1, 2])));
    expect(rules("properties.occluded = false")).toEqual(all(c("properties.occluded", "eq", false)));
  });

  it("reads true/false saved before the grammar had booleans", () => {
    const legacy: ASTNode = [
      "eq",
      [
        ["get", ["properties.occluded"]],
        ["get", ["true"]],
      ],
    ];
    expect(rules(legacy)).toEqual(all(c("properties.occluded", "eq", true)));
  });

  it("flattens a chain of the same operator into one group", () => {
    expect(rules('category = "a" and category = "b" and category = "c"')).toEqual(
      all(c("category", "eq", "a"), c("category", "eq", "b"), c("category", "eq", "c")),
    );
    // Left-nested: (a and b) and c
    expect(rules('(category = "a" and category = "b") and category = "c"')).toEqual(
      all(c("category", "eq", "a"), c("category", "eq", "b"), c("category", "eq", "c")),
    );
  });

  it("turns a different operator into a nested group, at any depth", () => {
    expect(
      rules(`(category match "vehicles/*")
        and (properties.plateReadable = true)
        and ((properties.occluded = false) or ((properties.level = "partial") and (properties.lanes > 1)))`),
    ).toEqual(
      all(
        c("category", "match", "vehicles/*"),
        c("properties.plateReadable", "eq", true),
        any(
          c("properties.occluded", "eq", false),
          all(c("properties.level", "eq", "partial"), c("properties.lanes", "gt", 1)),
        ),
      ),
    );
  });

  it.each([
    ["a variable on the right", "properties.a = properties.b"],
    ["a literal on the left", '"vehicles/car" = category'],
    ["a list outside in", 'category = ["a", "b"]'],
    ["in without a list", 'category in "a"'],
  ])("returns null for %s", (_, input) => {
    expect(rules(input)).toBeNull();
  });

  it("returns null for an unknown operator or a malformed node", () => {
    expect(rulesFromAst(["xor", [["get", ["category"]], "a"]])).toBeNull();
    expect(rulesFromAst(["and", [["eq", [["get", ["category"]], "a"]]]])).toBeNull();
  });

  it("returns null when any part of a group can't be shown", () => {
    expect(rules('category = "a" and properties.a = properties.b')).toBeNull();
  });

  it("gives every group and condition a distinct id", () => {
    const group = rulesFromAst(parse('category = "a" and (category = "b" or category = "c")'))!;
    const ids: string[] = [];
    const collect = (item: RuleItem) => {
      ids.push(item.id);
      if (isRuleGroup(item)) item.items.forEach(collect);
    };
    collect(group);
    expect(new Set(ids).size).toBe(5);
  });
});

describe("rulesToAst", () => {
  it("returns true for an empty group", () => {
    expect(rulesToAst(newGroup("all", []))).toBe(true);
  });

  it("drops empty nested groups", () => {
    expect(rulesToAst(newGroup("all", [newGroup("any", []), newGroup("all", [])]))).toBe(true);
    expect(rulesToAst(newGroup("all", [newGroup("any", []), newCondition("category", "eq", "vehicles/car")]))).toEqual(
      parse('category = "vehicles/car"'),
    );
  });

  it("returns a single condition without a wrapping and/or", () => {
    expect(rulesToAst(newGroup("any", [newCondition("category", "eq", "traffic-light")]))).toEqual([
      "eq",
      [["get", ["category"]], "traffic-light"],
    ]);
  });

  it("nests a chain to the right, as the parser does", () => {
    const group = newGroup("all", [
      newCondition("category", "eq", "a"),
      newCondition("category", "eq", "b"),
      newCondition("category", "eq", "c"),
    ]);
    expect(rulesToAst(group)).toEqual(parse('category = "a" and category = "b" and category = "c"'));
  });

  it("unwraps a nested group with one item", () => {
    const group = newGroup("all", [
      newCondition("category", "eq", "a"),
      newGroup("any", [newCondition("properties.occluded", "eq", true)]),
    ]);
    expect(rulesToAst(group)).toEqual(parse('category = "a" and properties.occluded = true'));
  });

  it("wraps lists so AstProcessor reads them as one value", () => {
    expect(rulesToAst(newGroup("all", [newCondition("category", "in", ["pedestrian", "cyclist"])]))).toEqual([
      "in",
      [["get", ["category"]], [["pedestrian", "cyclist"]]],
    ]);
  });
});

const roundTrips = [
  'category = "traffic-light"',
  '(category = "traffic-sign") and (properties.signType = "speedLimit")',
  '(properties.occluded = true) and ((category match "vehicles/*") or (category in ["pedestrian", "cyclist"]))',
  `(category match "vehicles/*")
    and (properties.plate-readable = true)
    and ((properties.occluded = false) or (properties.occlusion_level = "partial"))`,
  "(properties.lanes >= 2) or (properties.lanes in [4, 6])",
];

describe("round trips", () => {
  it.each(roundTrips)("AST -> rules -> AST keeps %s", (input) => {
    const ast = parse(input);
    expect(rulesToAst(rulesFromAst(ast)!)).toEqual(ast);
  });

  it.each(roundTrips)("AST -> text -> AST keeps %s", (input) => {
    const ast = parse(input);
    expect(parse(visibilityToText(ast))).toEqual(ast);
  });
});

describe("visibilityToText", () => {
  it("prints no condition as an empty string", () => {
    expect(visibilityToText(true)).toBe("");
  });

  it("prints a single comparison without parentheses", () => {
    expect(visibilityToText(parse('category = "traffic-light"'))).toBe('category = "traffic-light"');
  });

  it("prints lists and booleans", () => {
    expect(visibilityToText(parse('category in ["pedestrian", "cyclist"]'))).toBe(
      'category in ["pedestrian", "cyclist"]',
    );
    expect(visibilityToText(parse("properties.lanes in [1, 2]"))).toBe("properties.lanes in [1, 2]");
    expect(visibilityToText(parse("properties.occluded = false"))).toBe("properties.occluded = false");
  });

  it("puts each condition on its own line and indents nested groups", () => {
    const ast = parse(
      '(category match "vehicles/*") and (properties.plateReadable = true) and ((properties.occluded = false) or (properties.level = "partial"))',
    );
    expect(visibilityToText(ast)).toBe(
      [
        '(category match "vehicles/*")',
        "and (properties.plateReadable = true)",
        "and (",
        "  (properties.occluded = false)",
        '  or (properties.level = "partial")',
        ")",
      ].join("\n"),
    );
  });

  it("prints rules the builder can't show", () => {
    expect(visibilityToText(parse("properties.a = properties.b"))).toBe("properties.a = properties.b");
  });

  it("prints true/false saved before the grammar had booleans, which then parse as booleans", () => {
    const legacy: ASTNode = [
      "eq",
      [
        ["get", ["properties.occluded"]],
        ["get", ["true"]],
      ],
    ];
    expect(parse(visibilityToText(legacy))).toEqual(parse("properties.occluded = true"));
  });
});

describe("group helpers", () => {
  it("tells groups from conditions", () => {
    const group: RuleGroup = newGroup("all", [newCondition("category", "eq", "a")]);
    expect(isRuleGroup(group)).toBe(true);
    expect(isRuleGroup(group.items[0])).toBe(false);
  });
});
