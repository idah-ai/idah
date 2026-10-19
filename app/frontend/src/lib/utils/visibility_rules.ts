// ---------------------------------------------------------------------------
// visibility_rules.ts — property visibility AST <-> builder rules
// ---------------------------------------------------------------------------
//
// A property's `visibility` is stored as `true` (always shown) or an AST
// produced by ast_parser.pegjs. The visibility builder edits it as a tree of
// groups instead:
//
//   ["and", [A, ["or", [B, C]]]]   <->   all [ A, any [ B, C ] ]
//
// Each group is an all/any list of conditions and nested groups. Chains of
// the same and/or flatten into one group; and/or are rebuilt nested to the
// right, as the parser produces them.

import type { ASTNode, ASTNodeValue, ASTValue } from "@/plugin/v2/types";

export type ComparisonOperator =
  | "eq"
  | "neq"
  | "lt"
  | "gt"
  | "lte"
  | "gte"
  | "in"
  | "match"
  | "has_any"
  | "has_all"
  | "has_none";
export type RuleValue = string | number | boolean | string[] | number[];

export interface RuleCondition {
  id: string;
  /** Variable path read from the annotation value, e.g. "category" or "properties.occluded". */
  field: string;
  operator: ComparisonOperator;
  /** A list with the list operators ("in" and "has_*"), a single value otherwise. */
  value: RuleValue;
}

export interface RuleGroup {
  id: string;
  /** all = and, any = or. */
  mode: "all" | "any";
  items: RuleItem[];
}

export type RuleItem = RuleCondition | RuleGroup;

export type Visibility = boolean | ASTNode;

const COMPARISON_SYMBOLS: Record<ComparisonOperator, string> = {
  eq: "=",
  neq: "!=",
  lt: "<",
  gt: ">",
  lte: "<=",
  gte: ">=",
  in: "in",
  match: "match",
  has_any: "contains any",
  has_all: "contains all",
  has_none: "contains none",
};

const LOGICAL = { all: "and", any: "or" } as const;

// Ids only key items in the builder's lists; they are not stored.
let lastRuleId = 0;
const nextRuleId = () => `rule-${++lastRuleId}`;

export function newCondition(field: string, operator: ComparisonOperator, value: RuleValue): RuleCondition {
  return { id: nextRuleId(), field, operator, value };
}

export function newGroup(mode: RuleGroup["mode"], items: RuleItem[]): RuleGroup {
  return { id: nextRuleId(), mode, items };
}

/** Operators whose value is a list: "in" and contains any / all / none. */
export function isListOperator(operator: string): boolean {
  return operator === "in" || operator === "has_any" || operator === "has_all" || operator === "has_none";
}

export function isRuleGroup(item: RuleItem): item is RuleGroup {
  return "items" in item;
}

// ─── AST shapes ─────────────────────────────────────────────────────────

function isNode(value: unknown): value is ASTNode {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && Array.isArray(value[1]);
}

function isComparison(operator: string): operator is ComparisonOperator {
  return operator in COMPARISON_SYMBOLS;
}

/** The variable name of a ["get", [name]] node, or undefined. */
function variableName(value: ASTNodeValue): string | undefined {
  if (isNode(value) && value[0] === "get" && typeof value[1][0] === "string") return value[1][0];
  return undefined;
}

/** The items of a list literal, which the parser stores wrapped: [["a", "b"]]. */
function listItems(value: ASTNodeValue): string[] | number[] | undefined {
  if (!Array.isArray(value) || value.length !== 1 || !Array.isArray(value[0])) return undefined;
  const items = value[0] as unknown[];
  if (items.every((v) => typeof v === "string")) return items as string[];
  if (items.every((v) => typeof v === "number")) return items as number[];
  return undefined;
}

/** All operands of a chain of the same and/or, e.g. a and (b and c) -> [a, b, c]. */
function flatten(node: ASTNode, logical: string): ASTNodeValue[] {
  if (node[0] !== logical) return [node];
  return node[1].flatMap((child) => (isNode(child) ? flatten(child, logical) : [child]));
}

// ─── AST -> rules ───────────────────────────────────────────────────────

/** The builder's rules for a visibility, or null when the builder can't show it. */
export function rulesFromAst(visibility: Visibility): RuleGroup | null {
  if (visibility === true) return newGroup("all", []);
  if (visibility === false || !isNode(visibility)) return null;
  if (visibility[0] === "and" || visibility[0] === "or") return groupFromAst(visibility);

  const condition = conditionFromAst(visibility);
  return condition && newGroup("all", [condition]);
}

function groupFromAst(node: ASTNode): RuleGroup | null {
  const logical = node[0];
  if (node[1].length !== 2) return null;

  const items: RuleItem[] = [];
  for (const operand of flatten(node, logical)) {
    if (!isNode(operand)) return null;
    const item = operand[0] === "and" || operand[0] === "or" ? groupFromAst(operand) : conditionFromAst(operand);
    if (!item) return null;
    items.push(item);
  }
  return newGroup(logical === "and" ? "all" : "any", items);
}

function conditionFromAst(node: ASTNode): RuleCondition | null {
  const [operator, args] = node;
  if (!isComparison(operator) || args.length !== 2) return null;

  const field = variableName(args[0]);
  if (!field) return null;

  const right = args[1];
  const list = listItems(right);
  if (isListOperator(operator)) return list ? newCondition(field, operator, list) : null;
  if (list) return null;

  if (typeof right === "string" || typeof right === "number" || typeof right === "boolean") {
    return newCondition(field, operator, right);
  }

  // Before the grammar had booleans, `= true` was stored as ["get", ["true"]].
  const legacy = variableName(right);
  if (legacy === "true" || legacy === "false") return newCondition(field, operator, legacy === "true");

  return null;
}

// ─── Rules -> AST ───────────────────────────────────────────────────────

/** The stored visibility for a group: true when it has no conditions. */
export function rulesToAst(group: RuleGroup): Visibility {
  return itemToAst(group) ?? true;
}

function itemToAst(item: RuleItem): ASTNode | null {
  if (!isRuleGroup(item)) {
    const value = Array.isArray(item.value) ? ([item.value] as [ASTValue]) : item.value;
    return [item.operator, [["get", [item.field]], value]];
  }

  const operands = item.items.map(itemToAst).filter((node): node is ASTNode => node !== null);
  if (operands.length === 0) return null;
  // a and b and c -> ["and", [a, ["and", [b, c]]]]
  return operands.reduceRight((right, left) => [LOGICAL[item.mode], [left, right]]);
}

// ─── AST -> text ────────────────────────────────────────────────────────

/**
 * The visibility as text the parser reads back to the same AST. Prints any
 * AST, including rules the builder can't show. Each operand of an and/or goes
 * on its own line, and nested groups are indented.
 *
 * Strings are printed in double quotes as-is: the grammar has no escape, so a
 * value containing `"` can't be printed in a form that parses.
 */
export function visibilityToText(visibility: Visibility): string {
  if (visibility === true) return "";
  if (visibility === false || !isNode(visibility)) return String(visibility);
  if (visibility[0] === "and" || visibility[0] === "or") return chainText(visibility, 0);
  return comparisonText(visibility);
}

const indent = (depth: number) => "  ".repeat(depth);

function chainText(node: ASTNode, depth: number): string {
  const logical = node[0];
  const operands = flatten(node, logical).map((operand) => operandText(operand, depth));
  return indent(depth) + operands.join(`\n${indent(depth)}${logical} `);
}

/** An operand of an and/or, always in parentheses. */
function operandText(operand: ASTNodeValue, depth: number): string {
  if (isNode(operand) && (operand[0] === "and" || operand[0] === "or")) {
    return `(\n${chainText(operand, depth + 1)}\n${indent(depth)})`;
  }
  return `(${isNode(operand) ? comparisonText(operand) : valueText(operand)})`;
}

function comparisonText(node: ASTNode): string {
  const [operator, args] = node;
  const symbol = isComparison(operator) ? COMPARISON_SYMBOLS[operator] : operator;
  return args.map(valueText).join(` ${symbol} `);
}

function valueText(value: ASTNodeValue): string {
  const name = variableName(value);
  if (name !== undefined) return name;

  const list = listItems(value);
  if (list) return `[${list.map((v) => valueText(v)).join(", ")}]`;

  if (typeof value === "string") return `"${value}"`;
  if (isNode(value)) return `(${comparisonText(value)})`;
  return String(value);
}
