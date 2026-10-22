import type { IAnnotationRecord, IConfig, IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";
import { annotationLabel } from "./label";

export interface BulkCategoryUpdate {
  id: string;
  category: string;
  properties: Record<string, unknown>;
}

type PropertyValue = string | number | string[] | boolean | undefined;
type PropertyValidator = (value: PropertyValue, property: IConfigProperty) => boolean;

export function categoryCounts(items: IAnnotationRecord[], config: IConfig): Map<string, { count: number; label: string }> {
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
): { updates: BulkCategoryUpdate[]; error?: string } {
  if (!items.length) return { updates: [], error: "No annotations selected." };

  const updates: BulkCategoryUpdate[] = [];
  for (const item of items) {
    const shapeConfig = driver.config[item.shape_type];
    if (!shapeConfig?.values.some((value) => value.id === category)) {
      return { updates: [], error: "The chosen category is not available for every selected annotation." };
    }

    const properties = { ...item.properties } as Record<string, unknown>;
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

    const invalid = visible.find((property) =>
      !propertyValid(properties[property.id] as PropertyValue, property),
    );
    if (invalid) return { updates: [], error: `${invalid.label} needs a valid value.` };

    updates.push({ id: item.id, category, properties });
  }
  return { updates };
}
