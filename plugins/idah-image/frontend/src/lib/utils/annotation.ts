// ---------------------------------------------------------------------------
// utils/annotation.ts — Shared annotation helpers
// ---------------------------------------------------------------------------

import type { IConfig } from "$idah/v2/types";
import type { IImageAnnotationRecord } from "$lib/types";

/** Format a category path like "vehicles/car" into a human-readable label like "Vehicles / Car". */
export function categoryValueToLabel(value?: string, replaceLabel?: string): string {
  if (!value) return "";
  const label = value.split("/").map((s) => s.slice(0, 1).toUpperCase() + s.slice(1));
  if (replaceLabel) {
    label[label.length - 1] = replaceLabel;
  } else {
    label.pop();
  }
  return label.join(" / ");
}

export function configuredCategories(config: IConfig) {
  return new Map(Object.values(config).flatMap((shape) => shape.values.map((value) => [value.id, value] as const)));
}

export function categoryForShape(
  config: IConfig,
  shapeType: string,
  id: string | undefined,
  configured: ReturnType<typeof configuredCategories>,
) {
  return config[shapeType]?.values.find((value) => value.id === id) ?? configured.get(id ?? "");
}

export function isOrphanCategory(id: string | undefined, configured: ReadonlyMap<string, unknown>): boolean {
  return !!id && !configured.has(id);
}

/** Return total of orphan annotations */
export function countOrphanAnnotations(annotations: IImageAnnotationRecord[], config: IConfig): number {
  const configured = configuredCategories(config);
  return annotations.filter((ann) => !ann.deleted_at && isOrphanCategory(ann.category, configured)).length;
}
