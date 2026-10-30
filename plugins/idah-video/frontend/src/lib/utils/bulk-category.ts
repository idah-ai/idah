import type { IAnnotationRecord, IConfig, IConfigProperty, IConfigValue, IIdahDriverV2 } from "$idah/v2/types";
import { annotationLabel } from "./label";

export interface BulkCategoryUpdate {
  id: string;
  category: string;
  properties: Record<string, unknown>;
}

export type PropertyValue = string | number | string[] | boolean | undefined;
type PropertyValidator = (value: PropertyValue, property: IConfigProperty) => boolean;

export function bulkPropertyValidity(
  items: IAnnotationRecord[],
  field: IConfigProperty,
  driver: IIdahDriverV2,
  category: string | undefined,
  changes: Record<string, PropertyValue>,
  propertyValid: PropertyValidator,
): boolean {
  return items.every((item) => {
    const properties = { ...item.properties } as Record<string, unknown>;
    for (const [id, value] of Object.entries(changes)) {
      if (value === undefined) delete properties[id];
      else properties[id] = value;
    }

    for (;;) {
      const filtered = driver.getFilteredConfig(item.shape_type, {
        category: category ?? item.category,
        properties,
      });
      if (!filtered) return false;
      const visibleIds = new Set(filtered.properties.map((property) => property.id));
      const hiddenKeys = Object.keys(properties).filter((id) => !visibleIds.has(id));
      if (!hiddenKeys.length) {
        const targetField = filtered.properties.find((property) => property.id === field.id);
        return !targetField || propertyValid(properties[field.id] as PropertyValue, targetField);
      }
      for (const id of hiddenKeys) delete properties[id];
    }
  });
}

export function hasMixedShapeTypes(items: IAnnotationRecord[]): boolean {
  return items.some((item) => item.shape_type !== items[0].shape_type);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }
  return a === b;
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalized(entry)]),
    );
  }
  return value;
}

function compatibleProperty(a: IConfigProperty, b: IConfigProperty): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.required === b.required &&
    JSON.stringify(normalized(a.format)) === JSON.stringify(normalized(b.format))
  );
}

export function sharedCategories(items: IAnnotationRecord[], config: IConfig): IConfigValue[] {
  if (!items.length) return [];
  const first = config[items[0].shape_type]?.values ?? [];
  const seen = new Set<string>();
  return first.filter((value) => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return items.every((item) => config[item.shape_type]?.values.some((candidate) => candidate.id === value.id));
  });
}

export function propertyState(items: IAnnotationRecord[], id: string): { mixed: boolean; value: PropertyValue } {
  const value = items[0]?.properties?.[id] as PropertyValue;
  const mixed = items.some((item) => !sameValue(item.properties?.[id], value));
  return { mixed, value: mixed ? undefined : value };
}

export function sharedProperties(
  items: IAnnotationRecord[],
  driver: IIdahDriverV2,
  category?: string,
  changes: Record<string, PropertyValue> = {},
): IConfigProperty[] {
  if (!items.length) return [];
  const fields = items.map((item) => {
    const properties = { ...item.properties };
    for (const [id, value] of Object.entries(changes)) {
      if (value === undefined) delete properties[id];
      else properties[id] = value;
    }
    for (;;) {
      const visible = driver.getFilteredConfig(item.shape_type, {
        category: category ?? item.category,
        properties,
      })?.properties;
      if (!visible) return undefined;
      const ids = new Set(visible.map((field) => field.id));
      const hiddenKeys = Object.keys(properties).filter((id) => !ids.has(id));
      if (!hiddenKeys.length) return visible;
      for (const id of hiddenKeys) delete properties[id];
    }
  });
  if (fields.some((value) => !value)) return [];
  return fields[0]!.filter((field) =>
    fields.every((list) => list!.some((candidate) => compatibleProperty(field, candidate))),
  );
}

export function bulkFields(
  items: IAnnotationRecord[],
  driver: IIdahDriverV2,
  draftCategory: string | undefined,
  draftProperties: Record<string, PropertyValue>,
): IConfigProperty[] {
  const visible = sharedProperties(items, driver, draftCategory, draftProperties);
  const cleared = sharedProperties(items, driver, draftCategory).filter(
    (field) =>
      Object.hasOwn(draftProperties, field.id) &&
      draftProperties[field.id] === undefined &&
      !visible.some((candidate) => candidate.id === field.id),
  );
  return [...visible, ...cleared];
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
      const label =
        annotationLabel(item, (categoryId) => config[item.shape_type]?.values.find((value) => value.id === categoryId))
          ?.text ?? item.category;
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
  preserveHiddenValues = false,
): { updates: BulkCategoryUpdate[]; error?: string } {
  if (!items.length) return { updates: [], error: "No annotations selected." };
  if (hasMixedShapeTypes(items))
    return { updates: [], error: "Editing is unavailable because the selected annotations have different shapes." };

  const available = new Set(sharedProperties(items, driver, category, changes).map((field) => field.id));
  if (Object.entries(changes).some(([id, value]) => value !== undefined && !available.has(id))) {
    return { updates: [], error: "The chosen property is not available for every selected annotation." };
  }

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
    const visibleProperties = preserveHiddenValues ? { ...properties } : properties;
    let visible: IConfigProperty[] = [];
    // Conditional visibility can change as hidden values are removed.
    for (;;) {
      const filtered = driver.getFilteredConfig(item.shape_type, { category, properties: visibleProperties });
      if (!filtered) return { updates: [], error: "The selected shape configuration is unavailable." };
      visible = filtered.properties;
      const visibleIds = new Set(visible.map((property) => property.id));
      const hiddenKeys = Object.keys(visibleProperties).filter((key) => !visibleIds.has(key));
      if (!hiddenKeys.length) break;
      for (const key of hiddenKeys) delete visibleProperties[key];
    }

    if (Object.entries(changes).some(([id, value]) => value !== undefined && !Object.hasOwn(visibleProperties, id))) {
      return { updates: [], error: "A chosen property becomes hidden after this change." };
    }

    const invalid = visible.find((property) => !propertyValid(visibleProperties[property.id] as PropertyValue, property));
    if (invalid) return { updates: [], error: `${invalid.label} needs a valid value.` };

    updates.push({ id: item.id, category, properties: preserveHiddenValues ? properties : visibleProperties });
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
  if (hasMixedShapeTypes(items))
    return { updates: [], error: "Editing is unavailable because the selected annotations have different shapes." };
  const ids = Object.keys(changes);
  if (!ids.length) return { updates: [], error: "Choose a property to apply." };

  const available = new Set(sharedProperties(items, driver).map((field) => field.id));
  if (ids.some((id) => !available.has(id))) {
    return { updates: [], error: "The chosen property is not available for every selected annotation." };
  }
  if (items.every((item) => ids.every((id) => sameValue(item.properties?.[id], changes[id])))) {
    return { updates: [], error: "No changes to apply." };
  }

  const updates: BulkCategoryUpdate[] = [];
  for (const item of items) {
    const result = prepareBulkCategory([item], item.category, driver, propertyValid, changes, true);
    if (result.error) return { updates: [], error: result.error };
    if (ids.some((id) => changes[id] !== undefined && !Object.hasOwn(result.updates[0].properties, id))) {
      return { updates: [], error: "The chosen property becomes hidden after this change." };
    }
    updates.push(result.updates[0]);
  }
  return { updates };
}

export function bulkPreview(
  items: IAnnotationRecord[],
  driver: IIdahDriverV2,
  draftCategory: string | undefined,
  draftProperties: Record<string, PropertyValue>,
  propertyValid: PropertyValidator,
): { updates: BulkCategoryUpdate[]; error?: string } | undefined {
  const hasPropertyEdit = Object.keys(draftProperties).length > 0;
  if (draftCategory && hasPropertyEdit && items.every((item) => item.category === draftCategory))
    return prepareBulkProperties(items, draftProperties, driver, propertyValid);
  if (draftCategory) return prepareBulkCategory(items, draftCategory, driver, propertyValid, draftProperties);
  if (hasPropertyEdit) return prepareBulkProperties(items, draftProperties, driver, propertyValid);
  return undefined;
}
