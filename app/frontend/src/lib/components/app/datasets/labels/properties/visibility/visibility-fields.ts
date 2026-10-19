// ---------------------------------------------------------------------------
// visibility-fields.ts — what the visibility builder can compare, and how
// ---------------------------------------------------------------------------
//
// A condition compares one field of the annotation value (its category or
// one of its properties) to a value. The field's kind decides which
// operators and which value control the builder offers.

import type { IConfigProperty, IConfigValue } from "@/plugin/v2/types";
import { humanize } from "@/utils/string";
import {
  isRuleGroup,
  newCondition,
  type ComparisonOperator,
  type RuleCondition,
  type RuleGroup,
  type RuleItem,
  type RuleValue,
} from "@/utils/visibility_rules";

/** "unsupported" fields (multi-select properties) can't be picked in the builder. */
export type FieldKind = "category" | "boolean" | "select" | "integer" | "text" | "unsupported";

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
  /** Values of a category or single-select field. */
  options: FieldOption[];
  /** Parent categories, for "is under". */
  parents: FieldOption[];
  /** The condition names a field that is no longer in the label config. */
  missing?: boolean;
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
  unsupported: [],
};

const PROPERTY_KINDS: Record<IConfigProperty["type"], FieldKind> = {
  text: "text",
  integer: "integer",
  boolean: "boolean",
  "single-select": "select",
  "multi-select": "unsupported",
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
          ? "select"
          : "text";
  return {
    path: condition.field,
    label: `${condition.field} (not found)`,
    kind,
    options: kind === "select" ? values.map((v) => ({ value: String(v), label: String(v) })) : [],
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

/** The value a new condition starts with. */
function defaultValue(field: VisibilityField, operator: BuilderOperator): RuleValue {
  if (operator === "in") return [];
  if (operator === "under") return `${field.parents[0]?.value ?? ""}/*`;
  if (field.kind === "boolean") return true;
  if (field.kind === "integer") return 0;
  if (field.kind === "category" || field.kind === "select") return field.options[0]?.value ?? "";
  return "";
}

/** A new condition on the first field the builder offers. */
export function defaultCondition(fields: VisibilityField[]): RuleCondition | undefined {
  const field = selectableFields(fields)[0];
  if (!field) return undefined;
  const operator = operatorsFor(field)[0].value as ComparisonOperator;
  return newCondition(field.path, operator, defaultValue(field, operator));
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
  } else if (operator === "in") {
    next = typeof value === "string" && current !== "under" && value !== "" ? [value] : [];
  } else if (current === "in") {
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
    if (value === "" || value === "/*") return field.kind === "text" ? "Enter a value" : "Choose a value";
    if (value.includes('"')) return "Values can't contain double quotes";
  }
  if (typeof value === "number" && !Number.isInteger(value)) return "Enter a whole number";
  return undefined;
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
  if (operator === "in") return Array.isArray(value) && value.every((v) => typeof v === "string");
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

  if (Array.isArray(value)) return value.map((v) => optionLabel(v, field.options)).join(", ");
  if (builderOperator(condition, field) === "under") return optionLabel(String(value).slice(0, -2), field.parents);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (field.kind === "category" || field.kind === "select") return optionLabel(value, field.options);
  return typeof value === "string" ? `"${value}"` : String(value);
}
