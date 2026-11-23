// ---------------------------------------------------------------------------
// done-area.ts — Whether the entry has any Done Area
//
// The Done Area lives in one COVERAGE_DONE_AREA annotation whose shape_args hold
// mask tiles (`tile-{col}x{row}`). Erasing an area sets its tile to null rather
// than deleting the record, so "has a Done Area" means at least one tile has
// content — not merely that the record exists.
// ---------------------------------------------------------------------------
import { COVERAGE_DONE_AREA } from "$lib/types";

interface AnnotationLike {
  shape_type: string;
  shape_args?: unknown;
}

export function hasDoneArea(items: readonly AnnotationLike[] | undefined): boolean {
  const record = items?.find((a) => a.shape_type === COVERAGE_DONE_AREA);
  const args = record?.shape_args;
  if (!args || typeof args !== "object") return false;
  return Object.entries(args as Record<string, unknown>).some(
    ([key, value]) => key.startsWith("tile-") && value != null,
  );
}
