// ---------------------------------------------------------------------------
// visibility-fields.ts — what the visibility builder can compare, and how
// ---------------------------------------------------------------------------
//
// A condition compares one field of the annotation value (its category or
// one of its properties) to a value. The field's kind decides which
// operators and which value control the builder offers.

import type { ASTNode, ASTNodeValue, IConfigProperty, IConfigValue } from "@/plugin/v2/types";
import { humanize } from "@/utils/string";
import {
  isListOperator,
  isRuleGroup,
  newCondition,
  type ComparisonOperator,
  type RuleCondition,
  type RuleGroup,
  type RuleItem,
  type RuleValue,
} from "@/utils/visibility_rules";

/** "multi" is a multi-select property; "unsupported" fields can't be picked in the builder. */
export type FieldKind = "category" | "boolean" | "select" | "multi" | "integer" | "text" | "unsupported";

export interface FieldOption {
  value: string;
  label: string;
  /** Shown under the label in lists, e.g. a category's parent path. */
  hint?: string;
}

export interface VisibilityField {
  /** Variable path in the condition, e.g. "category" or "properties.occluded". */
  path: string;
  label: string;
  kind: FieldKind;
  /** Values of a category, single-select or multi-select field. */
  options: FieldOption[];
  /** Parent categories, for "is under". */
  parents: FieldOption[];
  /** The condition names a field that is no longer in the label config. */
  missing?: boolean;
}

export interface VisibilityReferenceError {
  reference: string;
  message: string;
}

export interface ConditionReferenceProblems {
  field?: string;
  value?: string;
}

/** "under" is shown in the builder only; it is stored as category match "<parent>/*". */
export type BuilderOperator = ComparisonOperator | "under";

interface OperatorChoice {
  value: BuilderOperator;
  label: string;
}

const OPERATORS: Record<FieldKind, OperatorChoice[]> = {
  category: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "in", label: "is one of" },
    { value: "under", label: "is under" },
    { value: "match", label: "matches" },
  ],
  select: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "in", label: "is one of" },
  ],
  boolean: [{ value: "eq", label: "is" }],
  integer: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
  ],
  text: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "match", label: "matches" },
  ],
  multi: [
    { value: "has_any", label: "contains any of" },
    { value: "has_all", label: "contains all of" },
    { value: "has_none", label: "contains none of" },
  ],
  unsupported: [],
};

const PROPERTY_KINDS: Record<IConfigProperty["type"], FieldKind> = {
  text: "text",
  integer: "integer",
  boolean: "boolean",
  "single-select": "select",
  "multi-select": "multi",
};

// ─── Fields ─────────────────────────────────────────────────────────────

/**
 * The fields a property's visibility can depend on: the category, when the
 * config has categories, then every other property of the config.
 */
export function visibilityFields(
  categories: IConfigValue[],
  properties: IConfigProperty[],
  currentPropertyId: string,
): VisibilityField[] {
  const fields: VisibilityField[] = [];
  if (categories.length > 0) fields.push(categoryField(categories));

  for (const property of properties) {
    if (property.id === currentPropertyId) continue;
    fields.push({
      path: `properties.${property.id}`,
      label: property.label || property.id,
      kind: PROPERTY_KINDS[property.type] ?? "unsupported",
      options: (property.format?.options ?? []).map((o) => ({ value: o.id, label: o.label || o.id })),
      parents: [],
    });
  }
  return fields;
}

/**
 * Finds visibility references that no longer resolve against the current
 * label configuration. Expression-mode rules are validated here too, so the
 * check does not depend on whether the builder can represent the expression.
 */
export function visibilityReferenceErrors(
  visibility: boolean | ASTNode,
  categories: IConfigValue[],
  properties: IConfigProperty[],
): VisibilityReferenceError[] {
  if (typeof visibility === "boolean") return [];

  const propertyIds = new Set(properties.map((property) => property.id));
  const categoryIds = new Set(categories.map((category) => category.id));
  const errors: VisibilityReferenceError[] = [];

  function add(reference: string, message: string) {
    if (!errors.some((error) => error.reference === reference && error.message === message)) {
      errors.push({ reference, message });
    }
  }

  function walk(value: ASTNodeValue): void {
    if (Array.isArray(value)) {
      if (isAstNode(value)) {
        walkNode(value);
      } else {
        value.forEach(walk);
      }
    }
  }

  function walkNode(node: ASTNode): void {
    const [operator, args] = node;
    const field = getFieldName(args[0]);
    if (field) {
      if (field.startsWith("properties.")) {
        const propertyId = field.slice("properties.".length);
        if (!propertyIds.has(propertyId)) {
          add(field, `Visibility references missing property "${propertyId}".`);
        }
      } else if (field === "category") {
        validateCategoryValues(operator, args[1]);
      }
    }

    args.forEach(walk);
  }

  function validateCategoryValues(operator: string, value: ASTNodeValue): void {
    const values = listValues(value) ?? (typeof value === "string" ? [value] : []);
    if (values.length === 0) return;

    if (operator === "match") {
      for (const category of values) {
        if (category.endsWith("/*") && !hasCategoryPrefix(category.slice(0, -2))) {
          add(`category:${category}`, `Visibility references missing category path "${category.slice(0, -2)}".`);
        }
      }
      return;
    }

    if (operator === "eq" || operator === "neq" || operator === "in") {
      for (const category of values) {
        if (!categoryIds.has(category)) {
          add(`category:${category}`, `Visibility references missing category "${category}".`);
        }
      }
    }
  }

  function hasCategoryPrefix(prefix: string): boolean {
    return [...categoryIds].some((id) => id === prefix || id.startsWith(`${prefix}/`));
  }

  walkNode(visibility);
  return errors;
}

function isAstNode(value: ASTNodeValue): value is ASTNode {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && Array.isArray(value[1]);
}

function getFieldName(value: ASTNodeValue): string | undefined {
  return isAstNode(value) && value[0] === "get" && typeof value[1][0] === "string" ? value[1][0] : undefined;
}

function listValues(value: ASTNodeValue): string[] | undefined {
  if (!Array.isArray(value) || value.length !== 1 || !Array.isArray(value[0])) return undefined;
  const values = value[0];
  return values.every((entry) => typeof entry === "string") ? (values as string[]) : undefined;
}

/**
 * Only leaf categories are stored; parents exist as path prefixes and are
 * labelled the way the category tree labels them.
 */
function categoryField(categories: IConfigValue[]): VisibilityField {
  const parentPaths = new Set<string>();
  for (const category of categories) {
    const parts = category.id.split("/");
    for (let i = 1; i < parts.length; i++) parentPaths.add(parts.slice(0, i).join("/"));
  }

  return {
    path: "category",
    label: "Category",
    kind: "category",
    options: categoryOptions(
      categories.map((category) => ({ value: category.id, name: category.label || lastSegmentLabel(category.id) })),
    ),
    parents: categoryOptions([...parentPaths].map((path) => ({ value: path, name: lastSegmentLabel(path) }))),
  };
}

const lastSegmentLabel = (path: string) => humanize(path.split("/").at(-1) ?? path);
const pathLabel = (path: string) =>
  path
    .split("/")
    .map((part) => humanize(part))
    .join(" / ");

/**
 * Deep paths are too long for a narrow dropdown, so an option shows the
 * category's own name, with its parents as a hint. A name shared by several
 * categories keeps the full path so they can be told apart.
 */
function categoryOptions(entries: { value: string; name: string }[]): FieldOption[] {
  const counts = new Map<string, number>();
  for (const { name } of entries) counts.set(name, (counts.get(name) ?? 0) + 1);

  return entries.map(({ value, name }) => {
    const parent = value.includes("/") ? pathLabel(value.split("/").slice(0, -1).join("/")) : undefined;
    const label = parent && counts.get(name)! > 1 ? `${parent} / ${name}` : name;
    return parent ? { value, label, hint: parent } : { value, label };
  });
}

/** Fields the builder's field picker offers. */
export function selectableFields(fields: VisibilityField[]): VisibilityField[] {
  return fields.filter((field) => field.kind !== "unsupported");
}

/** The field a condition compares, or a placeholder when it is no longer in the config. */
export function fieldFor(fields: VisibilityField[], condition: RuleCondition): VisibilityField {
  const found = fields.find((field) => field.path === condition.field);
  if (found) return found;

  const { value } = condition;
  const values = Array.isArray(value) ? value : [value];
  const kind: FieldKind =
    typeof value === "boolean"
      ? "boolean"
      : typeof value === "number"
        ? "integer"
        : Array.isArray(value)
          ? condition.operator === "in"
            ? "select"
            : "multi"
          : "text";
  return {
    path: condition.field,
    label: `${condition.field} (not found)`,
    kind,
    options: Array.isArray(value) ? values.map((v) => ({ value: String(v), label: String(v) })) : [],
    parents: [],
    missing: true,
  };
}

// ─── Operators ──────────────────────────────────────────────────────────

/** The operators a field offers. */
export function operatorsFor(field: VisibilityField): OperatorChoice[] {
  const operators = OPERATORS[field.kind];
  return field.parents.length > 0 ? operators : operators.filter((o) => o.value !== "under");
}

/** The operator the builder shows for a condition. */
export function builderOperator(condition: RuleCondition, field: VisibilityField): BuilderOperator {
  const { operator, value } = condition;
  if (field.kind === "category" && operator === "match" && typeof value === "string" && value.endsWith("/*")) {
    const parent = value.slice(0, -2);
    if (field.parents.some((p) => p.value === parent)) return "under";
  }
  return operator;
}

export function operatorLabel(condition: RuleCondition, field: VisibilityField): string {
  const operator = builderOperator(condition, field);
  return OPERATORS[field.kind].find((o) => o.value === operator)?.label ?? operator;
}

/** Whether a single value is picked from the field's options; "matches" takes a typed pattern. */
export function usesOptions(field: VisibilityField, operator: BuilderOperator): boolean {
  return field.kind === "select" || (field.kind === "category" && operator !== "match");
}

/** The value a new condition starts with. */
function defaultValue(field: VisibilityField, operator: BuilderOperator): RuleValue {
  if (isListOperator(operator)) return [];
  if (operator === "under") return `${field.parents[0]?.value ?? ""}/*`;
  if (field.kind === "boolean") return true;
  if (field.kind === "integer") return 0;
  if (usesOptions(field, operator)) return field.options[0]?.value ?? "";
  return "";
}

/** A new condition on the first field the builder offers. */
export function defaultCondition(fields: VisibilityField[]): RuleCondition | undefined {
  const field = selectableFields(fields)[0];
  if (!field) return undefined;
  const operator = operatorsFor(field)[0].value as ComparisonOperator;
  return newCondition(field.path, operator, defaultValue(field, operator));
}

/**
 * The conditions a new "any" group starts with: the default condition and
 * the same one on the field's second value, so the group means something from
 * the start. Just the default condition when the field has no second value.
 */
export function defaultGroupConditions(fields: VisibilityField[]): RuleCondition[] {
  const first = defaultCondition(fields);
  if (!first) return [];

  const field = fieldFor(fields, first);
  const second = usesOptions(field, first.operator) ? field.options[1] : undefined;
  return second ? [first, newCondition(first.field, first.operator, second.value)] : [first];
}

/** The condition compared on another field, with that field's first operator. */
export function applyField(condition: RuleCondition, field: VisibilityField): RuleCondition {
  const operator = operatorsFor(field)[0]?.value ?? "eq";
  return toCondition(condition, field.path, operator, defaultValue(field, operator));
}

/** The condition with another operator, keeping its value where it still fits. */
export function applyOperator(
  condition: RuleCondition,
  operator: BuilderOperator,
  field: VisibilityField,
): RuleCondition {
  const current = builderOperator(condition, field);
  const { value } = condition;
  let next = value;

  if (operator === "under") {
    next = defaultValue(field, operator);
  } else if (isListOperator(operator)) {
    if (!Array.isArray(value)) next = typeof value === "string" && current !== "under" && value !== "" ? [value] : [];
  } else if (isListOperator(current)) {
    next = Array.isArray(value) && value.length > 0 ? value[0] : defaultValue(field, operator);
  } else if (current === "under") {
    next = defaultValue(field, operator);
  }
  return toCondition(condition, condition.field, operator, next);
}

function toCondition(
  condition: RuleCondition,
  field: string,
  operator: BuilderOperator,
  value: RuleValue,
): RuleCondition {
  return { ...condition, field, operator: operator === "under" ? "match" : operator, value };
}

// ─── Checks ─────────────────────────────────────────────────────────────

/** What the user must fix before the condition can be saved, if anything. */
export function conditionProblem(condition: RuleCondition, field: VisibilityField): string | undefined {
  const { value } = condition;
  if (Array.isArray(value)) {
    if (value.length === 0) return "Choose at least one option";
    if (value.some((v) => typeof v === "string" && v.includes('"'))) return "Values can't contain double quotes";
    return undefined;
  }
  if (typeof value === "string") {
    if (value === "/*") return "Choose a value";
    if (value === "")
      return field.kind === "text" || condition.operator === "match" ? "Enter a value" : "Choose a value";
    if (value.includes('"')) return "Values can't contain double quotes";
  }
  // Unsafe integers print in exponent form, which the parser can't read back.
  if (typeof value === "number" && !Number.isSafeInteger(value)) return "Enter a whole number";
  return undefined;
}

/** Identifies which builder control contains a stale configuration reference. */
export function conditionReferenceProblems(
  condition: RuleCondition,
  field: VisibilityField,
): ConditionReferenceProblems {
  if (field.missing) {
    return { field: `Field "${condition.field}" no longer exists.` };
  }

  if (condition.operator === "match" && typeof condition.value === "string" && !condition.value.endsWith("/*")) {
    return {};
  }

  const values = Array.isArray(condition.value) ? condition.value.map(String) : [String(condition.value)];
  const options =
    condition.operator === "match" && values.length === 1 && values[0].endsWith("/*") ? field.parents : field.options;
  const missing = values.filter((value) => value !== "" && !options.some((option) => option.value === value));
  if (missing.length === 0) return {};

  return {
    value: `Value${missing.length > 1 ? "s" : ""} ${missing.map((value) => `"${value}"`).join(", ")} no longer exist${missing.length > 1 ? "" : "s"}.`,
  };
}

export function hasProblems(item: RuleItem, fields: VisibilityField[]): boolean {
  if (isRuleGroup(item)) return item.items.some((child) => hasProblems(child, fields));
  return conditionProblem(item, fieldFor(fields, item)) !== undefined;
}

/** Whether every condition fits a field and operator the builder offers. */
export function canEditInBuilder(item: RuleItem, fields: VisibilityField[]): boolean {
  if (isRuleGroup(item)) return item.items.every((child) => canEditInBuilder(child, fields));

  const field = fieldFor(fields, item);
  const operator = builderOperator(item, field);
  if (!operatorsFor(field).some((o) => o.value === operator)) return false;

  const { value } = item;
  if (isListOperator(operator)) return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (field.kind === "boolean") return typeof value === "boolean";
  if (field.kind === "integer") return typeof value === "number";
  return typeof value === "string";
}

// ─── Description ────────────────────────────────────────────────────────

/** The rules as a sentence, e.g. "Occluded is yes and (Category is Car or Category is Bus)". */
export function describeRules(group: RuleGroup, fields: VisibilityField[]): string {
  return describeItems(group, fields, true);
}

function describeItems(item: RuleItem, fields: VisibilityField[], top = false): string {
  if (!isRuleGroup(item)) return describeCondition(item, fields);
  const joined = item.items.map((child) => describeItems(child, fields)).join(item.mode === "all" ? " and " : " or ");
  return top || item.items.length < 2 ? joined : `(${joined})`;
}

function describeCondition(condition: RuleCondition, fields: VisibilityField[]): string {
  const field = fieldFor(fields, condition);
  return `${field.label} ${operatorLabel(condition, field)} ${valueLabel(condition, field)}`;
}

/** A condition's value as the builder shows it. */
export function valueLabel(condition: RuleCondition, field: VisibilityField): string {
  const { value } = condition;
  const optionLabel = (v: string | number, options: FieldOption[]) =>
    options.find((o) => o.value === v)?.label ?? `${v} (not found)`;

  const operator = builderOperator(condition, field);
  if (Array.isArray(value)) return value.map((v) => optionLabel(v, field.options)).join(", ");
  if (operator === "under") return optionLabel(String(value).slice(0, -2), field.parents);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (usesOptions(field, operator)) return optionLabel(value, field.options);
  return typeof value === "string" ? `"${value}"` : String(value);
}
