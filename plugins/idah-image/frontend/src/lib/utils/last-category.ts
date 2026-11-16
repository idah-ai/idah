// ---------------------------------------------------------------------------
// last-category.ts — Category of the most recently created annotation, which
// the "reuse last category" shortcut picks for the next annotation.
// ---------------------------------------------------------------------------

export interface LastCategory {
  category: string;
  shapeType: string;
  annotationId: string;
}

interface CategorizedItem {
  id: string;
  shape_type: string;
  category?: string | null;
}

/**
 * The category of the newest annotation that has one. Annotation ids are
 * UUIDv7 (client and server), so the largest id is the most recently created,
 * including annotations created this session that the server hasn't echoed yet.
 * Shape types in `excludedShapeTypes` (tagging annotations) are skipped.
 */
export function findLastCategory(
  items: readonly CategorizedItem[],
  excludedShapeTypes: ReadonlySet<string>,
): LastCategory | undefined {
  let last: CategorizedItem | undefined;
  for (const item of items) {
    if (!item.category || excludedShapeTypes.has(item.shape_type)) continue;
    if (!last || item.id > last.id) last = item;
  }
  return last ? { category: last.category!, shapeType: last.shape_type, annotationId: last.id } : undefined;
}
