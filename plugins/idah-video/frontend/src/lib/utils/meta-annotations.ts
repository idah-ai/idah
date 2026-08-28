// ---------------------------------------------------------------------------
// meta-annotations.ts — Pure logic for entry-level (entry:root) and per-frame
// (idah-video:frame) meta annotations.
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

/** Find the single entry:root annotation in a list of annotation items. */
export function findEntryRootAnnotation(items: IVideoAnnotationRecord[]): IVideoAnnotationRecord | undefined {
  return items.find((a) => (a.shape as { type?: string })?.type === ENTRY_ROOT);
}

/** Find the idah-video:frame annotation for a specific frame value. */
export function findFrameAnnotation(
  items: IVideoAnnotationRecord[],
  frame: number,
): IVideoAnnotationRecord | undefined {
  return items.find(
    (a) => (a.shape as { type?: string })?.type === VIDEO_FRAME && a.shape.start === frame && a.shape.end === frame,
  );
}

export type EntryResolution<T> =
  | { action: "update"; existing: T }
  | { action: "create" }
  | { action: "none" };

/**
 * Decide whether setting the entry meta should update the existing entry:root
 * record, create a new one, or do nothing. Uniqueness is enforced client-side:
 * at most one entry:root annotation may exist per entry — a second write updates
 * the existing record instead of duplicating. "create" is returned only when no
 * record exists AND a category is provided (an empty meta is never created).
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
 * Decide whether setting the current frame's meta should update the existing
 * idah-video:frame record for that frame, create a new one, or do nothing.
 * Uniqueness is enforced client-side per frame value: at most one
 * idah-video:frame annotation may exist for a given frame — a second write for
 * the same frame updates the existing record instead of duplicating.
 */
export function resolveFrame(
  items: IVideoAnnotationRecord[],
  frame: number,
  value: IVideoAnnotationValue,
): EntryResolution<IVideoAnnotationRecord> {
  const existing = findFrameAnnotation(items, frame);
  if (existing) return { action: "update", existing };
  if (value.category) return { action: "create" };
  return { action: "none" };
}