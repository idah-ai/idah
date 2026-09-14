// ---------------------------------------------------------------------------
// recreate-annotation.ts — Helper to recreate an annotation with tile data
// restored via setShape/setShapes instead of embedded in dimensions.
//
// This is used by undo handlers that need to restore a deleted annotation
// while keeping tile keys out of the parent annotations.dimensions column.
// ---------------------------------------------------------------------------

import type { AnnotationItem } from "$lib/state/data.svelte";
import { stripTileKeys, extractTileEntries } from "$lib/mask/strip-tile-keys";
import { writeTileEntries } from "$lib/mask/write-tile-entries";

/**
 * Recreate an annotation and restore its tile entries.
 *
 * 1. Strips tile keys from the annotation's shape.
 * 2. Creates the annotation (without tile keys in dimensions).
 * 3. Restores tile entries via writeTileEntries (setShape/setShapes).
 *
 * @param annotations - The annotations driver (must have create, setShape, setShapes)
 * @param record - The annotation record to recreate (must have id, shape, value, etc.)
 */
export async function recreateAnnotationWithTiles(
  annotations: {
    create: (data: Partial<AnnotationItem> & { id?: string }) => Promise<AnnotationItem>;
    setShape: (annotationId: string, key: string, value: object | null) => Promise<void>;
    setShapes: (annotationId: string, entries: Array<{ key: string; value: object | null }>) => Promise<void>;
  },
  record: AnnotationItem,
): Promise<void> {
  const { shape: _shape, ...rest } = record;
  const cleanShape = _shape ? stripTileKeys(_shape as Record<string, unknown>) : {};
  await annotations.create({ ...rest, id: record.id, shape: cleanShape as any });
  // Restore tiles via setShape/setShapes so they land in annotation_shape, not dimensions
  if (_shape) {
    const entries = extractTileEntries(_shape as Record<string, unknown>);
    await writeTileEntries(annotations, record.id, entries);
  }
}