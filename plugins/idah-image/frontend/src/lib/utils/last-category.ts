// ---------------------------------------------------------------------------
// last-category.ts — Category of the most recently created annotation, and what
// the "reuse last category" shortcut does with it.
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

export type CategoryReuse =
  | { action: "none" }
  | { action: "draw"; category: string; shapeType: string }
  | { action: "relabel"; category: string; shapeType: string };

/**
 * What reusing the last category does:
 * - nothing created yet → nothing;
 * - a selection with another category → change the selection to it;
 * - otherwise (nothing selected, or the selection already has it, typically the
 *   annotation just drawn) → pick it to draw the next annotation.
 */
export function planCategoryReuse(
  last: LastCategory | undefined,
  selectedCategory: string | null | undefined,
  hasSelection: boolean,
): CategoryReuse {
  if (!last) return { action: "none" };
  const { category, shapeType } = last;
  if (hasSelection && selectedCategory !== category) return { action: "relabel", category, shapeType };
  return { action: "draw", category, shapeType };
}
