// ---------------------------------------------------------------------------
// ast_parser.test.ts — visibility condition grammar (ast_parser.pegjs)
// ---------------------------------------------------------------------------
//
// The grammar is compiled from source here, so these tests don't depend on
// `pnpm run build:parser` having produced build/parser.js.

import peggy from "peggy";
import { describe, expect, it } from "vitest";

import { AstProcessor, objectVariables } from "@/plugin/v2/utils/ast-evaluator";
import type { ASTNode } from "@/plugin/v2/types";

import grammar from "./ast_parser.pegjs?raw";
import { slugify } from "./string";

const parser = peggy.generate(grammar);
const parse = (input: string): ASTNode => parser.parse(input);

const get = (name: string) => ["get", [name]];

/** Parse a condition and evaluate it the way the driver does in getFilteredConfig. */
function evaluate(input: string, value: Record<string, unknown>): boolean {
  return new AstProcessor(new Map(objectVariables(value))).processAST(parse(input));
}

describe("ast_parser grammar", () => {
  describe("comparisons", () => {
    it.each([
      ["=", "eq"],
      ["!=", "neq"],
      ["<", "lt"],
      [">", "gt"],
      ["<=", "lte"],
      [">=", "gte"],
      ["match", "match"],
    ])("parses %s as %s", (symbol, op) => {
      expect(parse(`category ${symbol} "vehicles/car"`)).toEqual([op, [get("category"), "vehicles/car"]]);
    });

    it("parses integers", () => {
      expect(parse("properties.lanes > 2")).toEqual(["gt", [get("properties.lanes"), 2]]);
    });

    it("parses in with a list of strings", () => {
      expect(parse('category in ["pedestrian", "cyclist"]')).toEqual([
        "in",
        [get("category"), [["pedestrian", "cyclist"]]],
      ]);
    });

    it("allows spaces inside a list", () => {
      expect(parse('category in [ "pedestrian" , "cyclist" ]')).toEqual(parse('category in ["pedestrian", "cyclist"]'));
    });
  });

  describe("variable names", () => {
    it("accepts underscores", () => {
      expect(parse('properties.is_occluded = "yes"')).toEqual(["eq", [get("properties.is_occluded"), "yes"]]);
    });

    it("accepts hyphens", () => {
      expect(parse('properties.occlusion-level = "heavy"')).toEqual([
        "eq",
        [get("properties.occlusion-level"), "heavy"],
      ]);
    });

    it("accepts the property ids the label editor generates from multi-word labels", () => {
      const id = slugify("Occlusion level");
      expect(parse(`properties.${id} = "heavy"`)).toEqual(["eq", [get(`properties.${id}`), "heavy"]]);
    });
  });

  describe("booleans", () => {
    it("parses true and false as values, not variables", () => {
      expect(parse("properties.occluded = true")).toEqual(["eq", [get("properties.occluded"), true]]);
      expect(parse("properties.occluded = false")).toEqual(["eq", [get("properties.occluded"), false]]);
    });

    it("still reads names that start with true or false as variables", () => {
      expect(parse('trueColor = "red"')).toEqual(["eq", [get("trueColor"), "red"]]);
      expect(parse("properties.flag = falsePositive")).toEqual(["eq", [get("properties.flag"), get("falsePositive")]]);
    });
  });

  describe("contains any / all / none", () => {
    it.each([
      ["any", "has_any"],
      ["all", "has_all"],
      ["none", "has_none"],
    ])("parses contains %s as %s", (kind, op) => {
      expect(parse(`properties.colors contains ${kind} ["red", "blue"]`)).toEqual([
        op,
        [get("properties.colors"), [["red", "blue"]]],
      ]);
    });

    it("needs any, all or none after contains", () => {
      expect(() => parse('properties.colors contains ["red"]')).toThrow();
      expect(() => parse('properties.colors contains anything ["red"]')).toThrow();
    });
  });

  describe("and / or", () => {
    it("parses and / or in either case", () => {
      const lower = parse('category = "a" or category = "b"');
      expect(lower).toEqual([
        "or",
        [
          ["eq", [get("category"), "a"]],
          ["eq", [get("category"), "b"]],
        ],
      ]);
      expect(parse('category = "a" OR category = "b"')).toEqual(lower);
    });

    it("parses nested groups", () => {
      expect(
        parse(`(properties.occluded = true)
          and (
            (category match "vehicles/*")
            or (category in ["pedestrian", "cyclist"])
          )`),
      ).toEqual([
        "and",
        [
          ["eq", [get("properties.occluded"), true]],
          [
            "or",
            [
              ["match", [get("category"), "vehicles/*"]],
              ["in", [get("category"), [["pedestrian", "cyclist"]]]],
            ],
          ],
        ],
      ]);
    });

    it("needs a word break after and / or", () => {
      expect(() => parse("properties.a = 1 order = 2")).toThrow();
    });
  });

  it("allows whitespace and blank lines around the condition", () => {
    expect(parse('\n  category = "a"  \n')).toEqual(parse('category = "a"'));
  });

  it("rejects single-quoted strings", () => {
    expect(() => parse("category = 'vehicles/car'")).toThrow();
  });
});

describe("parsed conditions evaluated by AstProcessor", () => {
  const box = { category: "vehicles/car", properties: { "occlusion-level": "heavy", occluded: true, lanes: 3 } };

  it("matches booleans", () => {
    expect(evaluate("properties.occluded = true", box)).toBe(true);
    expect(evaluate("properties.occluded = false", box)).toBe(false);
  });

  it("reads hyphenated property ids", () => {
    expect(evaluate('properties.occlusion-level = "heavy"', box)).toBe(true);
  });

  it("evaluates nested groups", () => {
    const rule = `(properties.occluded = true) and ((category match "vehicles/*") or (category = "pedestrian"))`;
    expect(evaluate(rule, box)).toBe(true);
    expect(evaluate(rule, { ...box, category: "traffic-light" })).toBe(false);
  });
  describe("contains any / all / none on a multi-select value", () => {
    const tagged = { properties: { colors: ["red", "blue"] } };

    it.each([
      ['contains any ["red", "green"]', true],
      ['contains any ["green"]', false],
      ['contains all ["red", "blue"]', true],
      ['contains all ["red", "green"]', false],
      ['contains none ["green"]', true],
      ['contains none ["blue", "green"]', false],
    ])("%s is %s", (condition, expected) => {
      expect(evaluate(`properties.colors ${condition}`, tagged)).toBe(expected);
    });

    it("treats an unanswered multi-select as empty", () => {
      expect(evaluate('properties.colors contains any ["red"]', {})).toBe(false);
      expect(evaluate('properties.colors contains all ["red"]', {})).toBe(false);
      expect(evaluate('properties.colors contains none ["red"]', {})).toBe(true);
    });
  });

  describe("unknown operators", () => {
    it("evaluate to false instead of throwing, so the property is hidden", () => {
      const processor = new AstProcessor(new Map());
      expect(processor.processAST(["future_op", [["get", ["category"]], "a"]] as ASTNode)).toBe(false);
    });

    it("only fail their own branch", () => {
      const processor = new AstProcessor(new Map([["category", "a"]]));
      const rule = [
        "or",
        [
          ["future_op", [1, 2]],
          ["eq", [["get", ["category"]], "a"]],
        ],
      ] as ASTNode;
      expect(processor.processAST(rule)).toBe(true);
    });
  });
});
