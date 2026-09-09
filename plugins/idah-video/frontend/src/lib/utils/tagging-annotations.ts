// ---------------------------------------------------------------------------
// tagging-annotations.ts — Pure logic for entry-level (entry:root) and per-frame
// (idah-video:frame) tagging annotations.
//
// Kept as plain functions (no Svelte runes) so the uniqueness rules can be
// unit-tested in isolation. The workspace components call these and translate
// the returned resolution into add/update commands.
// ---------------------------------------------------------------------------

import {
  VIDEO_FRAME,
  ENTRY_ROOT,
  type IVideoAnnotationRecord,
  type IVideoAnnotationValue,
} from "$lib/types";
import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
import type { IConfigProperty } from "$idah/v2/types";

/**
 * Single owner of the "is this tagging value valid to persist" check for both
 * entry:root and idah-video:frame. Creating and updating must both pass this
 * before persisting. The caller resolves the shape's filtered properties via
 * the driver config and passes them in, keeping this function pure/testable.
 */
export function isTaggingValueComplete(
  value: IVideoAnnotationValue,
  properties: IConfigProperty[] = [],
): boolean {
  return requiredFullfilled(value as unknown as Record<string, unknown>, properties);
}

/** Find the single entry:root annotation in a list of annotation items. */
export function findEntryRootAnnotation(items: IVideoAnnotationRecord[]): IVideoAnnotationRecord | undefined {
  return items.find((a) => (a.shape as { type?: string })?.type === ENTRY_ROOT);
}

/**
 * Find the idah-video:frame annotation for a specific frame value and category.
 * Uniqueness is enforced per (frame, category): at most one frame annotation
 * may exist per category per frame — mirroring how image masks allow one mask per
 * category. A different category at the same frame yields a distinct annotation.
 */
export function findFrameAnnotation(
  items: IVideoAnnotationRecord[],
  frame: number,
  category: string,
): IVideoAnnotationRecord | undefined {
  return items.find(
    (a) =>
      (a.shape as { type?: string })?.type === VIDEO_FRAME &&
      a.shape.start === frame &&
      a.shape.end === frame &&
      a.value?.category === category,
  );
}

/** All idah-video:frame annotations for a specific frame value (any category). */
export function findFrameAnnotations(
  items: IVideoAnnotationRecord[],
  frame: number,
): IVideoAnnotationRecord[] {
  return items.filter(
    (a) =>
      (a.shape as { type?: string })?.type === VIDEO_FRAME &&
      a.shape.start === frame &&
      a.shape.end === frame,
  );
}

export type EntryResolution<T> =
  | { action: "update"; existing: T }
  | { action: "create" }
  | { action: "none" };

/**
 * Decide whether setting the entry tagging should update the existing entry:root
 * record, create a new one, or do nothing. Uniqueness is enforced client-side:
 * at most one entry:root annotation may exist per entry — a second write updates
 * the existing record instead of duplicating. "create" is returned only when no
 * record exists AND a category is provided (an empty tagging is never created).
 */
export function resolveEntryRoot(
  items: IVideoAnnotationRecord[],
  value: IVideoAnnotationValue,
): EntryResolution<IVideoAnnotationRecord> {
  const existing = findEntryRootAnnotation(items);
  if (existing) return { action: "update", existing };
  if (value.category) return { action: "create" };
  return { action: "none" };
}

/**
 * Decide whether setting the current frame's tagging for a given category should
 * update the existing idah-video:frame record for that (frame, category), create a
 * new one, or do nothing. Uniqueness is enforced client-side per (frame, category):
 * at most one idah-video:frame annotation may exist per category per frame — a
 * second write for the same (frame, category) updates the existing record instead of
 * duplicating. A different category at the same frame creates a separate annotation.
 */
export function resolveFrame(
  items: IVideoAnnotationRecord[],
  frame: number,
  category: string,
  value: IVideoAnnotationValue,
): EntryResolution<IVideoAnnotationRecord> {
  const existing = findFrameAnnotation(items, frame, category);
  if (existing) return { action: "update", existing };
  if (value.category) return { action: "create" };
  return { action: "none" };
}