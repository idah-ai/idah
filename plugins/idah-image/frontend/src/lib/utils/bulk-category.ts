import type { IAnnotationRecord, IConfig, IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";
import { annotationLabel } from "./label";

export interface BulkCategoryUpdate {
  id: string;
  category: string;
  properties: Record<string, unknown>;
}

export type PropertyValue = string | number | string[] | boolean | undefined;
type PropertyValidator = (value: PropertyValue, property: IConfigProperty) => boolean;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }
  return a === b;
}

export function propertyState(items: IAnnotationRecord[], id: string): { mixed: boolean; value: PropertyValue } {
  const value = items[0]?.properties?.[id] as PropertyValue;
  const mixed = items.some((item) => !sameValue(item.properties?.[id], value));
  return { mixed, value: mixed ? undefined : value };
}

export function sharedProperties(items: IAnnotationRecord[], driver: IIdahDriverV2): IConfigProperty[] {
  if (!items.length) return [];
  const fields = items.map((item) => driver.getFilteredConfig(item.shape_type, {
    category: item.category, properties: item.properties,
  })?.properties);
  if (fields.some((value) => !value)) return [];
  return fields[0]!.filter((field) => fields.every((list) =>
    list!.some((candidate) => candidate.id === field.id && candidate.type === field.type),
  ));
}

export function categoryCounts(
  items: IAnnotationRecord[],
  config: IConfig,
): Map<string, { count: number; label: string }> {
  const counts = new Map<string, { count: number; label: string }>();
  for (const item of items) {
    const existing = counts.get(item.category);
    if (existing) {
      existing.count += 1;
    } else {
      const label = annotationLabel(item, (categoryId) =>
        config[item.shape_type]?.values.find((value) => value.id === categoryId),
      )?.text ?? item.category;
      counts.set(item.category, { count: 1, label });
    }
  }
  return counts;
}

export function prepareBulkCategory(
  items: IAnnotationRecord[],
  category: string,
  driver: IIdahDriverV2,
  propertyValid: PropertyValidator,
  changes: Record<string, PropertyValue> = {},
): { updates: BulkCategoryUpdate[]; error?: string } {
  if (!items.length) return { updates: [], error: "No annotations selected." };

  const updates: BulkCategoryUpdate[] = [];
  for (const item of items) {
    const shapeConfig = driver.config[item.shape_type];
    if (!shapeConfig?.values.some((value) => value.id === category)) {
      return { updates: [], error: "The chosen category is not available for every selected annotation." };
    }

    const properties = { ...item.properties } as Record<string, unknown>;
    for (const [id, value] of Object.entries(changes)) {
      if (value === undefined) delete properties[id];
      else properties[id] = value;
    }
    let visible: IConfigProperty[] = [];
    // Conditional visibility can change as hidden values are removed.
    for (;;) {
      const filtered = driver.getFilteredConfig(item.shape_type, { category, properties });
      if (!filtered) return { updates: [], error: "The selected shape configuration is unavailable." };
      visible = filtered.properties;
      const visibleIds = new Set(visible.map((property) => property.id));
      const hiddenKeys = Object.keys(properties).filter((key) => !visibleIds.has(key));
      if (!hiddenKeys.length) break;
      for (const key of hiddenKeys) delete properties[key];
    }

    const invalid = visible.find((property) => !propertyValid(properties[property.id] as PropertyValue, property));
    if (invalid) return { updates: [], error: `${invalid.label} needs a valid value.` };

    updates.push({ id: item.id, category, properties });
  }
  return { updates };
}

export function prepareBulkProperties(
  items: IAnnotationRecord[],
  changes: Record<string, PropertyValue>,
  driver: IIdahDriverV2,
  propertyValid: PropertyValidator,
): { updates: BulkCategoryUpdate[]; error?: string } {
  if (!items.length) return { updates: [], error: "No annotations selected." };
  const ids = Object.keys(changes);
  if (!ids.length) return { updates: [], error: "Choose a property to apply." };

  const available = new Set(sharedProperties(items, driver).map((field) => field.id));
  if (ids.some((id) => !available.has(id))) {
    return { updates: [], error: "The chosen property is not available for every selected annotation." };
  }
  if (items.every((item) => ids.every((id) => sameValue(item.properties?.[id], changes[id])))) {
    return { updates: [], error: "All selected annotations already use those property values." };
  }

  const updates: BulkCategoryUpdate[] = [];
  for (const item of items) {
    const result = prepareBulkCategory([item], item.category, driver, propertyValid, changes);
    if (result.error) return { updates: [], error: result.error };
    if (ids.some((id) => changes[id] !== undefined && !Object.hasOwn(result.updates[0].properties, id))) {
      return { updates: [], error: "The chosen property becomes hidden after this change." };
    }
    updates.push(result.updates[0]);
  }
  return { updates };
}
