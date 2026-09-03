// ---------------------------------------------------------------------------
// tagging-annotations.ts — Pure logic for entry-level (entry:root) tagging annotations.
//
// Kept as plain functions (no Svelte runes) so the uniqueness rules can be
// unit-tested in isolation. The workspace components call these and translate
// the returned resolution into add/update commands.
// ---------------------------------------------------------------------------

import { ENTRY_ROOT, type IImageAnnotationRecord, type IImageAnnotationValue } from "$lib/types";
import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
import type { IConfigProperty } from "$idah/v2/types";

/**
 * Single owner of the "is this entry:root tagging value valid to persist" check.
 * Creating and updating must both pass this before persisting. The caller resolves
 * the shape's filtered properties via the driver config and passes them in,
 * keeping this function pure/testable.
 */
export function isTaggingValueComplete(
  value: IImageAnnotationValue,
  properties: IConfigProperty[] = [],
): boolean {
  return requiredFullfilled(value as unknown as Record<string, unknown>, properties);
}

/** Find the single entry:root annotation in a list of annotation items. */
export function findEntryRootAnnotation(items: IImageAnnotationRecord[]): IImageAnnotationRecord | undefined {
  return items.find((a) => (a.shape as { type?: string })?.type === ENTRY_ROOT);
}

export type EntryResolution =
  | { action: "update"; existing: IImageAnnotationRecord }
  | { action: "create" }
  | { action: "none" };

/**
 * Decide whether settingthe entry tagging should update the existing entry:root
 * record, create a new one, or do nothing. Uniqueness is enforced client-side:
 * at most one entry:root annotation may exist per entry — a second write updates
 * the existing record instead of duplicating. "create" is returned only when no
 * record exists AND a category is provided (an empty tagging is never created).
 */
export function resolveEntryRoot(
  items: IImageAnnotationRecord[],
  value: IImageAnnotationValue,
): EntryResolution {
  const existing = findEntryRootAnnotation(items);
  if (existing) return { action: "update", existing };
  if (value.category) return { action: "create" };
  return { action: "none" };
}