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

export function categoryForShape(
  config: IConfig,
  shapeType: string,
  id: string | undefined,
) {
  return config[shapeType]?.values.find((value) => value.id === id);
}

/** Return total of orphan annotations */
export function countOrphanAnnotations(annotations: IImageAnnotationRecord[], config: IConfig): number {
  return annotations.filter((ann) => !ann.deleted_at && !categoryForShape(config, ann.shape_type, ann.category)).length;
}
